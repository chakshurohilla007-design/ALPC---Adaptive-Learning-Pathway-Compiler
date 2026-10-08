const mongoose = require('mongoose');

module.exports = mongoose.model('TheoryAttempt', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  questionId: { type: String, required: true },
  skill: { type: String, required: true },
  answer: { type: String, required: true },
  score: { type: Number, required: true },
  maxMarks: { type: Number, enum: [5, 10], required: true },
  status: { type: String, enum: ['estimated'], default: 'estimated' },
  feedback: [{ label: String, marks: Number, maxMarks: Number, detected: Boolean, guidance: String }],
}, { timestamps: true }));
