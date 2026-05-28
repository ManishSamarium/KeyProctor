const express = require('express');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const AuthLog = require('../models/AuthLog');
const Lab = require('../models/Lab');
const LabSubmission = require('../models/LabSubmission');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/faculty/overview
router.get('/overview', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ faculty: req.user.id });
    const studentIds = enrollments.map(e => e.student);
    const students = await User.find({ _id: { $in: studentIds } }).select('-passwordHash');
    const exams = await Exam.find({ faculty: req.user.id });
    const submissions = await Submission.find({ exam: { $in: exams.map(e => e._id) } });
    const flagged = submissions.filter(s => s.integrity?.grade === 'Flagged');
    const labs = await Lab.find({ faculty: req.user.id });
    const labSubmissions = await LabSubmission.find({ lab: { $in: labs.map(l => l._id) } });

    res.json({
      totalStudents: students.length,
      totalExams: exams.length,
      totalSubmissions: submissions.length,
      flaggedCount: flagged.length,
      enrolledCount: students.filter(s => s.enrolled).length,
      totalLabs: labs.length,
      totalLabSubmissions: labSubmissions.length,
      students: students.map(s => ({
        id: s._id,
        username: s.username,
        fullName: s.fullName,
        enrollmentNo: s.enrollmentNo,
        enrolled: s.enrolled,
        sampleCount: s.keystrokeSamples?.length || 0
      })),
      recentSubmissions: submissions
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faculty/students
router.get('/students', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ faculty: req.user.id });
    const studentIds = enrollments.map(e => e.student);
    const students = await User.find({ _id: { $in: studentIds } }).select('-passwordHash -refreshToken');
    res.json(students.map(s => ({
      id: s._id,
      username: s.username,
      fullName: s.fullName,
      enrollmentNo: s.enrollmentNo,
      enrolled: s.enrolled,
      sampleCount: s.keystrokeSamples?.length || 0
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/enroll-student
router.post('/enroll-student', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const { studentUsername } = req.body;
    const student = await User.findOne({ username: studentUsername.toLowerCase(), role: 'student' });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    await Enrollment.findOneAndUpdate(
      { student: student._id, faculty: req.user.id },
      { student: student._id, faculty: req.user.id },
      { upsert: true, new: true }
    );
    res.json({ message: `${student.fullName} enrolled successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faculty/auth-logs/:username
router.get('/auth-logs/:username', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const logs = await AuthLog.find({ username: req.params.username }).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
