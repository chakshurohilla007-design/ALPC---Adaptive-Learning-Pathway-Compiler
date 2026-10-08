'use strict';
process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { questions, findQuestion, grade } = require('../services/theory');
const TheoryAttempt = require('../models/TheoryAttempt');
const { signToken } = require('../middleware/auth');
const User = require('../models/User');
const review = require('../services/theoryReview');

test('every rubric totals exactly 5 or 10 marks', () => {
  for (const q of questions) for (const marks of [5, 10]) {
    const question = findQuestion(q.id, marks);
    assert.equal(question.rubric.length, marks);
    assert.equal(grade(question, question.rubric.map(c => c.terms[0]).join('. ')).score, marks);
  }
  assert.equal(findQuestion('missing', 5), null);
  assert.equal(findQuestion('arrays', '5'), null);
});

test('teacher authorization uses live account identity and confirmation retries preserve marks', async () => {
  const savedEnv = process.env.THEORY_REVIEWER_EMAILS;
  process.env.THEORY_REVIEWER_EMAILS = 'teacher@example.com';
  const originals = { user: User.findById, find: TheoryAttempt.findOne, change: TheoryAttempt.findOneAndUpdate, update: TheoryAttempt.updateOne, apply: review.applyConfirmedMark };
  const teacherId = '507f1f77bcf86cd799439012';
  const studentId = '507f1f77bcf86cd799439011';
  const teacher = { _id: teacherId, email: 'teacher@example.com' };
  const student = { _id: studentId, email: 'student@example.com' };
  const attempt = { _id: '507f1f77bcf86cd799439013', userId: studentId, reviewerEmail: teacher.email, status: 'pending', maxMarks: 5, skill: 'Stacks' };
  let applyCalls = 0;
  let fail = true;
  User.findById = async id => String(id) === teacherId ? teacher : student;
  TheoryAttempt.findOne = async filter => filter.reviewerEmail === attempt.reviewerEmail ? { ...attempt } : null;
  TheoryAttempt.findOneAndUpdate = async (_filter, update) => { Object.assign(attempt, update.$set); return { ...attempt }; };
  TheoryAttempt.updateOne = async (_filter, update) => { Object.assign(attempt, update.$set); };
  review.applyConfirmedMark = async () => { applyCalls++; if (fail) { fail = false; throw new Error('Temporary outage'); } return 0.42; };
  const app = express(); app.use(express.json()); app.use('/api/theory', require('../routes/theory'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/theory/reviews/${attempt._id}/confirm`;
  async function send(user, body) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ ...user, name: 'Test' })}` }, body: JSON.stringify(body) }); }
  try {
    assert.equal((await send({ ...student, email: teacher.email }, { score: 5, comment: 'Looks correct.' })).status, 403, 'spoofed token email is ignored');
    assert.equal((await send(teacher, { score: 6, comment: 'Too many marks.' })).status, 400);
    assert.equal((await send(teacher, { score: 2.25, comment: 'Invalid fraction.' })).status, 400);
    attempt.reviewerEmail = 'someoneelse@example.com';
    assert.equal((await send(teacher, { score: 3.5, comment: 'Partial understanding.' })).status, 404);
    attempt.reviewerEmail = teacher.email;
    const body = { score: 3.5, comment: 'Partial understanding.' };
    assert.equal((await send(teacher, body)).status, 503);
    assert.equal(attempt.status, 'confirmed');
    assert.equal(attempt.confirmedScore, 3.5);
    assert.equal((await send(teacher, { ...body, score: 5 })).status, 409);
    assert.equal((await send(teacher, body)).status, 200);
    assert.equal(attempt.masteryApplied, true);
    assert.equal(applyCalls, 2);
    process.env.THEORY_REVIEWER_EMAILS = '';
    assert.equal((await send(teacher, body)).status, 403, 'removing teacher access takes effect immediately');
  } finally {
    if (savedEnv === undefined) delete process.env.THEORY_REVIEWER_EMAILS; else process.env.THEORY_REVIEWER_EMAILS = savedEnv;
    User.findById = originals.user; TheoryAttempt.findOne = originals.find; TheoryAttempt.findOneAndUpdate = originals.change; TheoryAttempt.updateOne = originals.update; review.applyConfirmedMark = originals.apply;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});

test('empty, unrelated, repeated, substring and negated terms do not inflate marks', () => {
  const q = findQuestion('stacks', 5);
  assert.equal(grade(q, '').score, 0);
  assert.equal(grade(q, 'A bush grows outside.').score, 0);
  assert.equal(grade(q, 'push push push push').score, 1);
  assert.equal(grade(q, 'This uses pushdown and popcorn.').score, 0);
  assert.equal(grade(q, 'A stack is not LIFO.').score, 0);
  assert.equal(grade(q, 'LIFO.').masteryUpdated, false);
  assert.equal(grade(q, 'LIFO.').status, 'estimated');
});

test('routes authenticate, validate confirmation, ignore client scores and isolate history', async () => {
  const originalCreate = TheoryAttempt.create;
  const originalFind = TheoryAttempt.find;
  let saved;
  let historyFilter;
  TheoryAttempt.create = async doc => { saved = doc; return { ...doc, _id: 'attempt1' }; };
  TheoryAttempt.find = filter => { historyFilter = filter; return { sort: () => ({ limit: async () => [] }) }; };
  const app = express();
  app.use(express.json());
  app.use('/api/theory', require('../routes/theory'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/theory`;
  const token = signToken({ _id: '507f1f77bcf86cd799439011', email: 'test@example.com', name: 'Test' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = { questionId: 'stacks', marks: 5, answer: 'This answer describes a stack using LIFO.', textConfirmed: true, score: 5, userId: 'other' };
  try {
    assert.equal((await fetch(`${base}/questions`)).status, 401);
    const questionsResponse = await fetch(`${base}/questions`, { headers });
    const bank = await questionsResponse.json();
    assert.equal(bank.questions.length, questions.length);
    assert.equal(bank.questions[0].criteria, undefined);
    for (const invalid of [{ ...body, textConfirmed: false }, { ...body, marks: 7 }, { ...body, answer: 'short' }, { ...body, answer: 'x'.repeat(12001) }]) {
      assert.equal((await fetch(`${base}/submit`, { method: 'POST', headers, body: JSON.stringify(invalid) })).status, 400);
    }
    const response = await fetch(`${base}/submit`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).masteryUpdated, false);
    assert.equal(saved.score, 1);
    assert.equal(saved.userId, '507f1f77bcf86cd799439011');
    await fetch(`${base}/attempts`, { headers });
    assert.deepEqual(historyFilter, { userId: saved.userId });
    TheoryAttempt.create = async () => { throw new Error('database unavailable'); };
    assert.equal((await fetch(`${base}/submit`, { method: 'POST', headers, body: JSON.stringify(body) })).status, 500);
  } finally {
    TheoryAttempt.create = originalCreate;
    TheoryAttempt.find = originalFind;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
