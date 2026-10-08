'use strict';

/**
 * Review scheduling, quiz option shuffling, the JWT secret rule, the rate
 * limiter, account deletion, AND/OR pathway rules and the optimizer stage.
 * Database models are replaced with in-memory stubs; compiler tests use the
 * real alpc, lli and opt and are skipped when the compiler is missing.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (_) { /* plain environment variables only */ }

let passed = 0;
let failed = 0;
async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

function request(server, method, url, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: server.address().port, method, path: url,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\nReview, quiz and security\n');

  const { dueForReview, intervalDays } = require('../services/review');
  const DAY = 864e5;
  const now = new Date('2026-10-07T12:00:00Z');

  await runTest('weaker topics come up for review sooner', () => {
    assert.strictEqual(intervalDays(0.2), 2);
    assert.strictEqual(intervalDays(0.55), 4);
    assert.strictEqual(intervalDays(0.9), 7);
  });

  await runTest('a topic is due once its interval has passed, most overdue first', () => {
    const mastery = [
      { skill: 'Graphs', masteryScore: 0.2 },  // every 2 days, last 3 days ago -> due (1.5x)
      { skill: 'Trees', masteryScore: 0.5 },   // every 4 days, last 2 days ago -> not due
      { skill: 'Arrays', masteryScore: 0.9 },  // every 7 days, last 21 days ago -> due (3x)
      { skill: 'Queues', masteryScore: 0.1 },  // never practised -> not listed
    ];
    const last = {
      Graphs: new Date(now - 3 * DAY), Trees: new Date(now - 2 * DAY), Arrays: new Date(now - 21 * DAY),
    };
    const due = dueForReview(mastery, last, now);
    assert.deepStrictEqual(due.map(d => d.skill), ['Arrays', 'Graphs']);
    assert.strictEqual(due[0].daysSince, 21);
    assert.strictEqual(due[1].masteryPercent, 20);
  });

  const { present, answeredOnly } = require('../services/quizShuffle');

  await runTest('quiz options are shuffled and map back to the stored answer', () => {
    const q = { _id: 'q1', skill: 'Trees', difficulty: 'easy', text: '?', options: ['right', 'w1', 'w2', 'w3'], answer: 0 };
    const positions = new Set();
    for (let i = 0; i < 200; i++) {
      const shown = present(q);
      assert.deepStrictEqual([...shown.optionIndex].sort(), [0, 1, 2, 3]);
      shown.options.forEach((text, pos) => assert.strictEqual(text, q.options[shown.optionIndex[pos]]));
      positions.add(shown.options.indexOf('right'));
      assert.strictEqual(shown.answer, undefined, 'the answer key must not be sent');
    }
    assert.strictEqual(positions.size, 4, 'the right answer should appear in every position');
  });

  await runTest('unanswered questions are not submitted as option A', () => {
    const kept = answeredOnly([
      { questionId: 'a', selectedOption: 2 }, { questionId: 'b' }, { questionId: 'c', selectedOption: -1 },
      { questionId: 'd', selectedOption: 0 }, null,
    ]);
    assert.deepStrictEqual(kept.map(a => a.questionId), ['a', 'd']);
  });

  const { resolveSecret } = require('../middleware/auth');

  await runTest('production refuses a missing, public or short JWT secret', () => {
    for (const JWT_SECRET of [undefined, 'learnsmart-dev-secret', 'learnsmart-dev-secret-change-in-production', 'short']) {
      assert.throws(() => resolveSecret({ NODE_ENV: 'production', JWT_SECRET }), /JWT_SECRET must be set/);
    }
    const strong = 'k'.repeat(48);
    assert.strictEqual(resolveSecret({ NODE_ENV: 'production', JWT_SECRET: strong }), strong);
    assert.strictEqual(resolveSecret({ NODE_ENV: 'test' }), 'learnsmart-dev-secret');
  });

  const { rateLimit } = require('../middleware/rateLimit');

  await runTest('the rate limiter answers 429 with Retry-After once the limit is reached', () => {
    const limit = rateLimit({ windowMs: 60000, max: 3, name: 'compile' });
    const outcomes = [];
    for (let i = 0; i < 5; i++) {
      const res = {
        headers: {}, code: 200, body: null,
        set(k, v) { this.headers[k] = v; return this; },
        status(c) { this.code = c; return this; },
        json(b) { this.body = b; return this; },
      };
      let nexted = false;
      limit({ ip: '1.2.3.4' }, res, () => { nexted = true; });
      outcomes.push(nexted ? 200 : res.code);
      if (!nexted) assert(Number(res.headers['Retry-After']) > 0 && /Too many compile requests/.test(res.body.error));
    }
    assert.deepStrictEqual(outcomes, [200, 200, 200, 429, 429]);
    let other = false;
    limit({ ip: '5.6.7.8' }, {}, () => { other = true; });
    assert(other, 'another client has its own budget');
  });

  // ── Account deletion with stubbed models ─────────────────────────────────
  const bcrypt = require('bcryptjs');
  const express = require('express');
  const { signToken } = require('../middleware/auth');
  const models = {
    User: require('../models/User'), Attempt: require('../models/Attempt'), Mastery: require('../models/Mastery'),
    Recommendation: require('../models/Recommendation'), CompilerDecision: require('../models/CompilerDecision'),
    StudyProgress: require('../models/StudyProgress'), Pathway: require('../models/Pathway'), TheoryAttempt: require('../models/TheoryAttempt'),
  };
  const userId = '64b000000000000000000002';
  const hash = await bcrypt.hash('correct horse', 4);
  let userGone = false;
  const deletedFrom = [];
  models.User.findById = async () => (userGone ? null : { _id: userId, passwordHash: hash });
  models.User.deleteOne = async () => { userGone = true; return { deletedCount: 1 }; };
  for (const name of ['Attempt', 'Mastery', 'Recommendation', 'CompilerDecision', 'StudyProgress', 'Pathway', 'TheoryAttempt']) {
    models[name].deleteMany = async filter => { deletedFrom.push([name, filter]); return { deletedCount: 2 }; };
  }
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  const server = app.listen(0);
  const token = signToken({ _id: userId, email: 'a@b.c', name: 'A' });

  try {
    await runTest('deleting an account needs the password', async () => {
      assert.strictEqual((await request(server, 'DELETE', '/api/auth/account', { token, body: {} })).status, 400);
      const wrong = await request(server, 'DELETE', '/api/auth/account', { token, body: { password: 'nope' } });
      assert.strictEqual(wrong.status, 401);
      assert.strictEqual(deletedFrom.length, 0);
      assert.strictEqual(userGone, false);
    });

    await runTest('deleting an account removes everything stored for it', async () => {
      const r = await request(server, 'DELETE', '/api/auth/account', { token, body: { password: 'correct horse' } });
      assert.strictEqual(r.status, 200, JSON.stringify(r.body));
      assert.strictEqual(userGone, true);
      assert.deepStrictEqual(deletedFrom.map(([n]) => n).sort(),
        ['Attempt', 'CompilerDecision', 'Mastery', 'Pathway', 'Recommendation', 'StudyProgress', 'TheoryAttempt']);
      assert(deletedFrom.every(([n, f]) => String(n === 'Pathway' ? f.createdBy : f.userId) === userId));
    });

    await runTest('deleting needs a signed-in user', async () => {
      assert.strictEqual((await request(server, 'DELETE', '/api/auth/account', { body: { password: 'x' } })).status, 401);
    });
  } finally {
    server.close();
  }

  // ── Compiler: AND/OR rules and the optimizer ─────────────────────────────
  const { generatePathLang, ruleCondition } = require('../services/pathwayGenerator');

  await runTest('a rule with a second comparison is written with AND or OR', () => {
    assert.strictEqual(ruleCondition({ variable: 'performance', operator: '<', value: 50 }), 'performance < 50');
    assert.strictEqual(
      ruleCondition({ variable: 'performance', operator: '<', value: 50, also: { connector: 'OR', variable: 'mastery', operator: '<', value: 30 } }),
      'performance < 50 OR mastery < 30');
    assert.strictEqual(
      ruleCondition({ variable: 'performance', operator: '<', value: 50, also: { connector: 'XOR', variable: 'mastery', operator: '<', value: 30 } }),
      'performance < 50', 'an unknown connector is ignored');
  });

  const alpcBin = process.env.ALPC_BIN || path.join(__dirname, '..', '..', '..', process.platform === 'win32' ? 'alpc.exe' : 'alpc');
  if (!fs.existsSync(alpcBin)) {
    console.log(`\n  - skipped the compiler tests (compiler not found at ${alpcBin})`);
  } else {
    const { compile } = require('../services/alpcRunner');
    const source = generatePathLang({
      outcomes: ['remedial', 'core'],
      variables: { performance: 70, mastery: 20, state: 70 },
      rules: [
        { variable: 'performance', operator: '<', value: 50, outcome: 'remedial', also: { connector: 'OR', variable: 'mastery', operator: '<', value: 30 } },
        { variable: 'performance', operator: '>=', value: 50, outcome: 'core' },
      ],
    });

    await runTest('an OR rule is decided by the compiled program', async () => {
      const r = await compile(source);
      assert.strictEqual(r.success, true, r.diagnostics.map(d => d.message).join('; '));
      assert.strictEqual(r.outcome, 'remedial', 'mastery 20 < 30 makes the first rule hold');
      assert(r.irSource.includes('or.rhs.'), 'short-circuit block expected in the IR');
      assert(r.ast.children.some(c => c.label.includes('cond="(performance < 50 OR mastery < 30)"')), JSON.stringify(r.ast.children));
    });

    await runTest('the optimizer folds the program to its result', async () => {
      const r = await compile(source, { optimize: true });
      if (r.optimizeError && /not found/.test(r.optimizeError)) {
        console.log('        (opt not installed; checked that the error says so)');
        return;
      }
      assert.strictEqual(r.optimizeError, null, r.optimizeError);
      assert(/define .*@main/.test(r.optimizedIr));
      assert(!/icmp/.test(r.optimizedIr.split('@main')[1]), 'no comparisons should survive in @main');
      assert(/ret i32 70/.test(r.optimizedIr), 'the score is a constant after optimisation');
    });

    await runTest('without the option, compile does not run the optimizer', async () => {
      const r = await compile(source);
      assert.strictEqual(r.optimizedIr, null);
    });

    await runTest('an oversized program is refused with 413', async () => {
      await assert.rejects(compile('#'.repeat(40 * 1024)), err => err.status === 413);
    });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
