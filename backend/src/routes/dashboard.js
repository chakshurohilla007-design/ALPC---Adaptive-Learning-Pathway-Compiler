const express = require('express');
const mongoose = require('mongoose');
const Mastery = require('../models/Mastery');
const Attempt = require('../models/Attempt');
const TheoryAttempt = require('../models/TheoryAttempt');
const Recommendation = require('../models/Recommendation');
const { authMiddleware } = require('../middleware/auth');
const mlService = require('../services/mlService');
const { dueForReview } = require('../services/review');

const router = express.Router();

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const masteryRecords = await Mastery.find({ userId: req.user.id }).sort({ skill: 1 });
    const masteryMap = Object.fromEntries(
      masteryRecords.map((r) => [r.skill, r.masteryScore])
    );

    const analytics = await mlService.getAnalytics(masteryMap);
    const recommendations = await Recommendation.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(3);

    let nextTopic = analytics.nextTopic;
    if (!nextTopic && Object.keys(masteryMap).length > 0) {
      nextTopic = analytics.nextTopic;
    }

    const skills = masteryRecords.map((r) => ({
      skill: r.skill,
      masteryScore: r.masteryScore,
      masteryPercent: Math.round(r.masteryScore * 100),
      level: r.masteryScore >= 0.7 ? 'strong' : r.masteryScore >= 0.4 ? 'moderate' : 'weak',
      updatedAt: r.updatedAt,
    }));

    const last = await Attempt.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$skill', at: { $max: '$timestamp' } } },
    ]);
    const lastTheory = await TheoryAttempt.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id), status: 'confirmed', masteryApplied: true } },
      { $group: { _id: '$skill', at: { $max: '$reviewedAt' } } },
    ]);
    const lastPracticed = Object.fromEntries(last.map(l => [l._id, l.at]));
    for (const row of lastTheory) if (!lastPracticed[row._id] || row.at > lastPracticed[row._id]) lastPracticed[row._id] = row.at;
    const review = dueForReview(masteryRecords, lastPracticed);

    res.json({
      skills,
      masteryMap,
      review,
      weakestSkills: analytics.weakestSkills,
      learningPath: analytics.learningPath,
      nextTopic,
      analytics: {
        averageMastery: analytics.averageMastery,
        averageMasteryPercent: analytics.averageMasteryPercent,
        weakestSkill: analytics.weakestSkill,
        strongestSkill: analytics.strongestSkill,
      },
      recommendations,
    });
  } catch (err) {
    res.status(err.code === 'ML_UNAVAILABLE' ? 503 : 500).json({ error: err.message });
  }
});

router.get('/mastery', authMiddleware, async (req, res) => {
  try {
    const records = await Mastery.find({ userId: req.user.id });
    res.json({
      mastery: records.map((r) => ({
        skill: r.skill,
        masteryScore: r.masteryScore,
        masteryPercent: Math.round(r.masteryScore * 100),
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    res.status(err.code === 'ML_UNAVAILABLE' ? 503 : 500).json({ error: err.message });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('questionId', 'text skill difficulty');

    const grouped = {};
    for (const attempt of attempts) {
      const date = attempt.timestamp.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { date, total: 0, correct: 0 };
      grouped[date].total++;
      if (attempt.correctness) grouped[date].correct++;
    }

    const improvement = Object.values(grouped)
      .map((d) => ({
        date: d.date,
        accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
        attempts: d.total,
      }))
      .reverse();

    res.json({ attempts: attempts.slice(0, 20), improvementOverTime: improvement });
  } catch (err) {
    res.status(err.code === 'ML_UNAVAILABLE' ? 503 : 500).json({ error: err.message });
  }
});

router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const stored = await Recommendation.find({ userId: req.user.id }).sort({ createdAt: -1 });
    if (stored.length > 0) {
      return res.json({ recommendations: stored });
    }

    const masteryRecords = await Mastery.find({ userId: req.user.id });
    const masteryMap = Object.fromEntries(
      masteryRecords.map((r) => [r.skill, r.masteryScore])
    );
    const recommendations = await mlService.getBatchRecommendations(masteryMap);
    res.json({ recommendations });
  } catch (err) {
    res.status(err.code === 'ML_UNAVAILABLE' ? 503 : 500).json({ error: err.message });
  }
});

module.exports = router;
