'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Mastery = require('../models/Mastery');
const { applyConfirmedMark } = require('../services/theoryReview');

test('confirmed partial-credit marks apply once under retries and concurrent requests', { skip: !process.env.THEORY_TEST_MONGODB_URI }, async () => {
  await mongoose.connect(process.env.THEORY_TEST_MONGODB_URI);
  const userId = new mongoose.Types.ObjectId();
  const attempt = { _id: new mongoose.Types.ObjectId(), userId, skill: 'Stacks', confirmedScore: 4, maxMarks: 5 };
  try {
    await Mastery.init();
    await Mastery.create({ userId, skill: 'Stacks', masteryScore: 0.4 });
    const values = await Promise.all(Array.from({ length: 5 }, () => applyConfirmedMark(attempt)));
    assert(values.every(v => Math.abs(v - 0.52) < 1e-9));
    let record = await Mastery.findOne({ userId, skill: 'Stacks' });
    assert.deepEqual(record.appliedTheoryAttempts, [String(attempt._id)]);
    const updated = record.updatedAt.getTime();
    await applyConfirmedMark(attempt);
    record = await Mastery.findOne({ userId, skill: 'Stacks' });
    assert.equal(record.updatedAt.getTime(), updated, 'retry does not reset review schedule');
    const next = { ...attempt, _id: new mongoose.Types.ObjectId(), confirmedScore: 0 };
    const score = await applyConfirmedMark(next);
    assert(Math.abs(score - 0.364) < 1e-9);
    const first = await applyConfirmedMark({ ...attempt, _id: new mongoose.Types.ObjectId(), skill: 'Arrays' });
    assert(Math.abs(first - 0.45) < 1e-9, 'missing mastery starts at the normal 0.3 prior');
  } finally { await Mastery.deleteMany({ userId }); await mongoose.disconnect(); }
});
