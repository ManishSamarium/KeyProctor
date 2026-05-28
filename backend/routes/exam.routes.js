const express = require('express');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const AuthLog = require('../models/AuthLog');
const CopyPasteLog = require('../models/CopyPasteLog');
const Enrollment = require('../models/Enrollment');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/exams — Create exam (faculty only)
router.post('/', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const { title, subject, date, startTime, durationMins, instructions, questions } = req.body;
    const exam = await Exam.create({
      faculty: req.user.id,
      title, subject, date, startTime,
      durationMins: parseInt(durationMins),
      instructions,
      questions: questions.map((q, i) => ({
        questionId: q.questionId || `q_${i+1}`,
        text: q.text,
        marks: q.marks || 10,
        type: q.type || 'text'
      }))
    });
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams — List exams
router.get('/', verifyToken, async (req, res) => {
  try {
    let exams;
    if (req.user.role === 'faculty') {
      exams = await Exam.find({ faculty: req.user.id }).sort({ createdAt: -1 });
    } else {
      // Student: find exams from enrolled faculty
      const enrollments = await Enrollment.find({ student: req.user.id });
      const facultyIds = enrollments.map(e => e.faculty);
      exams = await Exam.find({ faculty: { $in: facultyIds } }).sort({ createdAt: -1 });
    }
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('faculty', 'fullName courseName');
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams/:id/submit — Submit exam
router.post('/:id/submit', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { sessionId, answers, authLog, cpLog } = req.body;
    const avgConf = authLog?.length
      ? authLog.reduce((s, a) => s + a.confidence, 0) / authLog.length
      : 0;

    // Calculate integrity score
    const pasteCount = cpLog?.length || 0;
    const behavioralScore = Math.max(0, Math.min(100, avgConf * 100));
    const pastePenalty = pasteCount === 0 ? 100 : pasteCount === 1 ? 80 : pasteCount === 2 ? 55 : 20;
    const integrityScore = behavioralScore * 0.6 + pastePenalty * 0.4;
    const grade = integrityScore >= 70 ? 'High' : integrityScore >= 40 ? 'Suspicious' : 'Flagged';

    const submission = await Submission.create({
      student: req.user.id,
      exam: req.params.id,
      sessionId,
      answers,
      avgConfidence: avgConf,
      cpCount: pasteCount,
      integrity: { behavioralScore, pastePenalty, integrityScore, grade }
    });

    res.json({ submission, integrity: { behavioralScore, pastePenalty, integrityScore, grade } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/:id/submissions — Faculty view
router.get('/:id/submissions', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const subs = await Submission.find({ exam: req.params.id })
      .populate('student', 'fullName username enrollmentNo');
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exams/:id
router.put('/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.id, faculty: req.user.id },
      req.body,
      { new: true }
    );
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exams/:id
router.delete('/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    await Exam.findOneAndDelete({ _id: req.params.id, faculty: req.user.id });
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
