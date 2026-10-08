const User = require('../models/User');
const Mastery = require('../models/Mastery');

function reviewerEmails() {
  return [...new Set((process.env.THEORY_REVIEWER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean))];
}

async function reviewerFor(userId) {
  const user = await User.findById(userId);
  return user && reviewerEmails().includes(user.email.toLowerCase()) ? user : null;
}

async function applyConfirmedMark(attempt) {
  const key = String(attempt._id);
  await Mastery.updateOne({ userId: attempt.userId, skill: attempt.skill }, {
    $setOnInsert: { userId: attempt.userId, skill: attempt.skill, masteryScore: 0.3, appliedTheoryAttempts: [] },
  }, { upsert: true });
  // Both the score update and replay guard are in the same atomic document write.
  const record = await Mastery.findOneAndUpdate(
    { userId: attempt.userId, skill: attempt.skill },
    [{ $set: {
      masteryScore: { $cond: [
        { $in: [key, { $ifNull: ['$appliedTheoryAttempts', []] }] },
        '$masteryScore',
        { $add: [{ $multiply: [{ $ifNull: ['$masteryScore', 0.3] }, 0.7] }, 0.3 * attempt.confirmedScore / attempt.maxMarks] },
      ] },
      updatedAt: { $cond: [{ $in: [key, { $ifNull: ['$appliedTheoryAttempts', []] }] }, '$updatedAt', '$$NOW'] },
      appliedTheoryAttempts: { $setUnion: [{ $ifNull: ['$appliedTheoryAttempts', []] }, [key]] },
    } }], { new: true },
  );
  if (!record) throw new Error('Mastery record is unavailable.');
  return record.masteryScore;
}

module.exports = { reviewerEmails, reviewerFor, applyConfirmedMark };
