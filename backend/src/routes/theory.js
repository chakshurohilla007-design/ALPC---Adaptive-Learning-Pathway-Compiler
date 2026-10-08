const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const TheoryAttempt = require('../models/TheoryAttempt');
const { questions, findQuestion, grade } = require('../services/theory');

const router = express.Router();
router.use(authMiddleware);
router.get('/questions', (_req, res) => res.json({ questions: questions.map(q => ({ id: q.id, skill: q.skill, prompt: q.prompt })) }));
router.get('/attempts', async (req, res) => {
  try {
    const attempts = await TheoryAttempt.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ attempts });
  } catch (_) { res.status(500).json({ error: 'Theory history could not be loaded.' }); }
});
router.post('/submit', rateLimit({ windowMs: 60000, max: 10, name: 'theory' }), async (req, res) => {
  const { questionId, marks, answer, textConfirmed } = req.body || {};
  const question = findQuestion(questionId, marks);
  if (!question) return res.status(400).json({ error: 'Choose a supported question and 5 or 10 marks.' });
  if (typeof answer !== 'string' || answer.trim().length < 20 || answer.length > 12000) {
    return res.status(400).json({ error: 'Enter an answer between 20 and 12,000 characters.' });
  }
  if (textConfirmed !== true) return res.status(400).json({ error: 'Check and confirm your answer text before submitting.' });
  try {
    const result = grade(question, answer.trim());
    const attempt = await TheoryAttempt.create({ userId: req.user.id, questionId, skill: question.skill, answer: answer.trim(), score: result.score, maxMarks: marks, feedback: result.feedback, status: result.status });
    res.json({ ...result, attemptId: attempt._id, skill: question.skill });
  } catch (_) { res.status(500).json({ error: 'Your theory answer could not be saved. Please retry.' }); }
});
module.exports = router;
