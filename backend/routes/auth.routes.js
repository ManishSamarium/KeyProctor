const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const { verifyToken } = require('../middleware/auth.middleware');
const mlService = require('../services/ml.service');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'typeproctor-secret-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'typeproctor-refresh-secret-2026';

// POST /api/auth/register
// Students: no faculty username needed. Samples collected on frontend after registration.
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, role, courseName, enrollmentNo } = req.body;
    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: username.toLowerCase(),
      passwordHash,
      fullName,
      role,
      courseName,
      enrollmentNo
    });

    // Auto-login: return token so frontend can immediately collect samples
    const accessToken = jwt.sign(
      { id: user._id, username: user.username, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const refreshToken = jwt.sign({ id: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        courseName: user.courseName,
        enrollmentNo: user.enrollmentNo,
        enrolled: user.enrolled,
        sampleCount: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.role !== role) return res.status(401).json({ error: 'Invalid role for this account' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign(
      { id: user._id, username: user.username, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const refreshToken = jwt.sign({ id: user._id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        courseName: user.courseName,
        enrollmentNo: user.enrollmentNo,
        enrolled: user.enrolled,
        sampleCount: user.keystrokeSamples?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-behavior
router.post('/verify-behavior', verifyToken, async (req, res) => {
  try {
    const { features } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !user.enrolled) {
      return res.json({ confidence: 1.0, decision: true, message: 'No enrollment — auto-pass' });
    }

    const featureList = typeof features === 'object' && !Array.isArray(features)
      ? [features.mean_dwell, features.std_dwell, features.median_dwell, features.max_dwell,
         features.mean_flight, features.std_flight, features.median_flight, features.min_flight,
         features.typing_speed_wpm, features.dwell_flight_ratio,
         features.rhythm_consistency, features.total_time_ms, features.n_keys]
      : features;

    const result = await mlService.predict(featureList, user.username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/enroll-sample
router.post('/enroll-sample', verifyToken, async (req, res) => {
  try {
    const { features } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const featureList = typeof features === 'object' && !Array.isArray(features)
      ? [features.mean_dwell, features.std_dwell, features.median_dwell, features.max_dwell,
         features.mean_flight, features.std_flight, features.median_flight, features.min_flight,
         features.typing_speed_wpm, features.dwell_flight_ratio,
         features.rhythm_consistency, features.total_time_ms, features.n_keys]
      : features;

    user.keystrokeSamples.push({ features: featureList });
    const count = user.keystrokeSamples.length;
    if (count >= 10) user.enrolled = true;
    await user.save();

    // If we have enough samples, retrain
    if (count >= 10) {
      const allEnrolled = await User.find({ enrolled: true });
      if (allEnrolled.length >= 2) {
        const usersData = allEnrolled.map(u => ({
          username: u.username,
          features: u.keystrokeSamples.map(s => s.features)
        }));
        mlService.retrain(usersData).catch(e => console.error('Retrain error:', e));
      }
    }

    res.json({ count, enrolled: user.enrolled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/courses — list all available courses (from faculty users)
router.get('/courses', async (req, res) => {
  try {
    const faculties = await User.find({ role: 'faculty' }).select('fullName courseName username');
    const courses = faculties
      .filter(f => f.courseName)
      .map(f => ({
        facultyId: f._id,
        facultyName: f.fullName,
        facultyUsername: f.username,
        courseName: f.courseName
      }));
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/enroll-course — student enrolls in a course (by faculty id)
router.post('/enroll-course', verifyToken, async (req, res) => {
  try {
    const { facultyId } = req.body;
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can enroll' });

    const faculty = await User.findOne({ _id: facultyId, role: 'faculty' });
    if (!faculty) return res.status(404).json({ error: 'Course not found' });

    await Enrollment.findOneAndUpdate(
      { student: req.user.id, faculty: faculty._id },
      { student: req.user.id, faculty: faculty._id },
      { upsert: true, new: true }
    );
    res.json({ message: `Enrolled in ${faculty.courseName} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/my-enrollments — student's enrolled courses
router.get('/my-enrollments', verifyToken, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id }).populate('faculty', 'fullName courseName username');
    res.json(enrollments.map(e => ({
      id: e._id,
      facultyId: e.faculty._id,
      facultyName: e.faculty.fullName,
      courseName: e.faculty.courseName,
      since: e.since
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash -refreshToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      courseName: user.courseName,
      enrollmentNo: user.enrollmentNo,
      enrolled: user.enrolled,
      sampleCount: user.keystrokeSamples?.length || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
