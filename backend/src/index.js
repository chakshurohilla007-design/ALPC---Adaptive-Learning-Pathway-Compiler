require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes      = require('./routes/auth');
const quizRoutes      = require('./routes/quiz');
const dashboardRoutes = require('./routes/dashboard');
const alpcRoutes      = require('./routes/alpc');
const studyRoutes     = require('./routes/study');
const Question        = require('./models/Question');
const Skill           = require('./models/Skill');
// ALPC integration models (auto-indexed on first connect)
require('./models/Pathway');
require('./models/CompilerDecision');
require('./models/StudyProgress');
const { QUESTIONS, SKILLS } = require('./seed');

const { hostingConfig } = require('./config/hosting');
const hosting = hostingConfig();
const app = express();
app.set('trust proxy', hosting.trustProxy);
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: hosting.origin, credentials: true }));
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'learnsmart-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/alpc', alpcRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/theory', require('./routes/theory'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnsmart';

async function ensureSeedData() {
  try {
    const questionCount = await Question.countDocuments();
    if (questionCount < QUESTIONS.length) {
      console.log(`Syncing questions bank (${questionCount} -> ${QUESTIONS.length})...`);
      for (const q of QUESTIONS) {
        await Question.updateOne(
          { text: q.text },
          { $set: q },
          { upsert: true }
        );
      }
      for (const name of SKILLS) {
        await Skill.updateOne(
          { name },
          { $set: { name, description: `${name} fundamentals for DSA` } },
          { upsert: true }
        );
      }
      console.log('Question bank synced successfully.');
    }
  } catch (err) {
    console.error('Auto-seed check error:', err.message);
  }
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await ensureSeedData();
    app.listen(PORT, () => console.log(`LearnSmart API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
