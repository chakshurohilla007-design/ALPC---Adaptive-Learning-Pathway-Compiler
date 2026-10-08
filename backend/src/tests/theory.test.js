'use strict';
process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { questions, findQuestion, grade } = require('../services/theory');
const TheoryAttempt = require('../models/TheoryAttempt');
const { signToken } = require('../middleware/auth');

test('every rubric totals exactly 5 or 10 marks', () => {
  for (const q of questions) for (const marks of [5, 10]) {
    const question = findQuestion(q.id, marks);
    assert.equal(question.rubric.length, marks);
    assert.equal(grade(question, question.rubric.map(c => c.terms[0]).join('. ')).score, marks);
  }
  assert.equal(findQuestion('missing', 5), null);
  assert.equal(findQuestion('arrays', '5'), null);
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
