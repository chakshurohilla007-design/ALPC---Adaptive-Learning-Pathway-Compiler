const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Mastery = require('../models/Mastery');
const Attempt = require('../models/Attempt');
const Recommendation = require('../models/Recommendation');
const CompilerDecision = require('../models/CompilerDecision');
const StudyProgress = require('../models/StudyProgress');
const TheoryAttempt = require('../models/TheoryAttempt');
const Pathway = require('../models/Pathway');
const { signToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

const SKILLS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks', 'Queues',
  'Trees', 'Graphs', 'Binary Search', 'Dynamic Programming',
];

async function initMasteryForUser(userId) {
  const records = SKILLS.map((skill) => ({
    userId,
    skill,
    masteryScore: 0.3,
  }));
  await Mastery.insertMany(records);
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_TAKEN' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    await initMasteryForUser(user._id);

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        diagnosticCompleted: user.diagnosticCompleted,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        diagnosticCompleted: user.diagnosticCompleted,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/account  { password }
// Removes the account and everything stored for it. Needs the password again,
// so a token left in a shared browser is not enough to wipe an account.
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Enter your password to delete your account.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'This account no longer exists.' });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'That password is not correct.' });
    }

    const userId = user._id;
    const removed = {};
    for (const [name, Model, filter] of [
      ['attempts', Attempt, { userId }],
      ['mastery', Mastery, { userId }],
      ['recommendations', Recommendation, { userId }],
      ['decisions', CompilerDecision, { userId }],
      ['studyProgress', StudyProgress, { userId }],
      ['theoryAttempts', TheoryAttempt, { userId }],
      ['pathways', Pathway, { createdBy: userId }],
    ]) {
      removed[name] = (await Model.deleteMany(filter)).deletedCount;
    }
    await User.deleteOne({ _id: userId });
    res.json({ deleted: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
