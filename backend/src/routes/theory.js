const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const TheoryAttempt = require('../models/TheoryAttempt');
const { questions, findQuestion, grade } = require('../services/theory');
const User = require('../models/User');
const mongoose = require('mongoose');
const review = require('../services/theoryReview');

const router = express.Router();
router.use(authMiddleware);
router.get('/questions', (_req, res) => res.json({ questions: questions.map(q => ({ id: q.id, skill: q.skill, prompt: q.prompt })) }));
router.get('/reviewers', async (req, res) => {
  try {
    const people = await User.find({ email: { $in: review.reviewerEmails() }, _id: { $ne: req.user.id } }).select('name email');
    res.json({ reviewers: people.map(p => ({ name: p.name, email: p.email })), canReview: Boolean(await review.reviewerFor(req.user.id)) });
  } catch (_) { res.status(500).json({ error: 'Reviewers could not be loaded.' }); }
});
router.get('/reviews', async (req, res) => {
  try {
    const teacher = await review.reviewerFor(req.user.id);
    if (!teacher) return res.status(403).json({ error: 'Teacher access is required.' });
    const attempts = await TheoryAttempt.find({ reviewerEmail: teacher.email.toLowerCase(), $or: [{ status: 'pending' }, { status: 'confirmed', masteryApplied: false }] }).sort({ createdAt: 1 }).limit(50).populate('userId', 'name');
    res.json({ attempts: attempts.map(a => ({ ...a.toObject(), prompt: findQuestion(a.questionId, a.maxMarks)?.prompt || a.skill })) });
  } catch (_) { res.status(500).json({ error: 'Review queue could not be loaded.' }); }
});
router.post('/reviews/:id/confirm', rateLimit({ windowMs: 60000, max: 30, name: 'theory-review' }), async (req, res) => {
  try {
    const teacher = await review.reviewerFor(req.user.id);
    if (!teacher) return res.status(403).json({ error: 'Teacher access is required.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid attempt ID.' });
    const { score, comment } = req.body || {};
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score * 2 !== Math.round(score * 2) || typeof comment !== 'string' || comment.trim().length < 5 || comment.length > 2000) {
      return res.status(400).json({ error: 'Enter marks in half-point increments and feedback between 5 and 2,000 characters.' });
    }
    let attempt = await TheoryAttempt.findOne({ _id: req.params.id, reviewerEmail: teacher.email.toLowerCase() });
    if (!attempt || String(attempt.userId) === String(teacher._id)) return res.status(404).json({ error: 'This answer is not assigned to you.' });
    if (!(await User.findById(attempt.userId))) return res.status(410).json({ error: 'The student account no longer exists.' });
    if (score > attempt.maxMarks) return res.status(400).json({ error: 'Marks exceed the question total.' });
    if (attempt.status === 'pending') {
      attempt = await TheoryAttempt.findOneAndUpdate({ _id: attempt._id, status: 'pending', reviewerEmail: teacher.email.toLowerCase() }, { $set: { status: 'confirmed', confirmedScore: score, reviewComment: comment.trim(), reviewedBy: teacher._id, reviewedAt: new Date() } }, { new: true });
      if (!attempt) return res.status(409).json({ error: 'Another review changed this answer. Reload the queue.' });
    } else if (attempt.status !== 'confirmed' || attempt.confirmedScore !== score || attempt.reviewComment !== comment.trim()) {
      return res.status(409).json({ error: 'Confirmed marks cannot be changed here. Retry with the original marks and feedback.' });
    }
    const mastery = await review.applyConfirmedMark(attempt);
    await TheoryAttempt.updateOne({ _id: attempt._id }, { $set: { masteryApplied: true } });
    res.json({ confirmed: true, score: attempt.confirmedScore, mastery, skill: attempt.skill });
  } catch (_) { res.status(503).json({ error: 'The review could not finish saving. Retry the same marks and feedback; mastery will only be updated once.' }); }
});
router.get('/attempts', async (req, res) => {
  try {
    const attempts = await TheoryAttempt.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ attempts });
  } catch (_) { res.status(500).json({ error: 'Theory history could not be loaded.' }); }
});
router.post('/submit', rateLimit({ windowMs: 60000, max: 10, name: 'theory' }), async (req, res) => {
  const { questionId, marks, answer, textConfirmed, reviewerEmail } = req.body || {};
  const question = findQuestion(questionId, marks);
  if (!question) return res.status(400).json({ error: 'Choose a supported question and 5 or 10 marks.' });
  if (typeof answer !== 'string' || answer.trim().length < 20 || answer.length > 12000) {
    return res.status(400).json({ error: 'Enter an answer between 20 and 12,000 characters.' });
  }
  if (textConfirmed !== true) return res.status(400).json({ error: 'Check and confirm your answer text before submitting.' });
  try {
    let assignedReviewer;
    if (reviewerEmail != null && reviewerEmail !== '') {
      if (typeof reviewerEmail !== 'string' || !review.reviewerEmails().includes(reviewerEmail.toLowerCase())) return res.status(400).json({ error: 'Choose an available teacher.' });
      assignedReviewer = await User.findOne({ email: reviewerEmail.toLowerCase() });
      if (!assignedReviewer || String(assignedReviewer._id) === req.user.id) return res.status(400).json({ error: 'Choose a different available teacher.' });
    }
    const result = grade(question, answer.trim());
    const status = assignedReviewer ? 'pending' : 'estimated';
    const attempt = await TheoryAttempt.create({ userId: req.user.id, questionId, skill: question.skill, answer: answer.trim(), score: result.score, maxMarks: marks, feedback: result.feedback, status, reviewerEmail: assignedReviewer?.email.toLowerCase() });
    res.json({ ...result, status, attemptId: attempt._id, skill: question.skill });
  } catch (_) { res.status(500).json({ error: 'Your theory answer could not be saved. Please retry.' }); }
});
module.exports = router;
