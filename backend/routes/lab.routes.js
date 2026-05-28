const express = require('express');
const axios = require('axios');
const Lab = require('../models/Lab');
const LabSubmission = require('../models/LabSubmission');
const Enrollment = require('../models/Enrollment');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// POST /api/labs — Create lab (faculty only)
router.post('/', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const { title, course, deadline, description, problems } = req.body;
    const lab = await Lab.create({
      faculty: req.user.id,
      title, course, deadline, description,
      problems: (problems || []).map((p, i) => ({
        problemId: p.problemId || `p_${i + 1}`,
        title: p.title,
        difficulty: p.difficulty || 'Easy',
        statement: p.statement,
        timeLimitS: p.timeLimitS || 3,
        memoryLimitMb: p.memoryLimitMb || 64,
        samples: p.samples || [],
        testCases: p.testCases || [],
        starterCode: p.starterCode || '',
        totalPoints: p.totalPoints || (p.testCases || []).reduce((s, tc) => s + (tc.points || 0), 0)
      }))
    });
    res.status(201).json(lab);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/labs — List labs
router.get('/', verifyToken, async (req, res) => {
  try {
    let labs;
    if (req.user.role === 'faculty') {
      labs = await Lab.find({ faculty: req.user.id }).sort({ createdAt: -1 });
    } else {
      const enrollments = await Enrollment.find({ student: req.user.id });
      const facultyIds = enrollments.map(e => e.faculty);
      labs = await Lab.find({ faculty: { $in: facultyIds } }).sort({ createdAt: -1 });
    }
    res.json(labs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/labs/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const lab = await Lab.findById(req.params.id).populate('faculty', 'fullName courseName');
    if (!lab) return res.status(404).json({ error: 'Lab not found' });
    res.json(lab);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/labs/:id
router.put('/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const lab = await Lab.findOneAndUpdate(
      { _id: req.params.id, faculty: req.user.id },
      req.body,
      { new: true }
    );
    if (!lab) return res.status(404).json({ error: 'Lab not found' });
    res.json(lab);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/labs/:id
router.delete('/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    await Lab.findOneAndDelete({ _id: req.params.id, faculty: req.user.id });
    res.json({ message: 'Lab deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/labs/:id/run — Compile & run code
router.post('/:id/run', verifyToken, async (req, res) => {
  try {
    const { code, stdin } = req.body;
    const { data } = await axios.post(`${ML_URL}/compile`, {
      code, stdin: stdin || '', timeout: 5
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Compilation service unavailable', stderr: err.message });
  }
});

// POST /api/labs/:id/submit — Submit solution for grading
router.post('/:id/submit', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { problemId, code } = req.body;
    const lab = await Lab.findById(req.params.id);
    if (!lab) return res.status(404).json({ error: 'Lab not found' });

    const problem = lab.problems.find(p => p.problemId === problemId);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });

    const testCases = problem.testCases.map(tc => ({
      input: tc.input || '',
      expected_output: tc.expected_output || '',
      points: tc.points || 0
    }));

    const { data: gradeResult } = await axios.post(`${ML_URL}/grade`, {
      code, test_cases: testCases, time_limit: problem.timeLimitS || 5
    });

    const prevCount = await LabSubmission.countDocuments({
      student: req.user.id, lab: req.params.id, problemId
    });

    const submission = await LabSubmission.create({
      student: req.user.id,
      lab: req.params.id,
      problemId,
      code,
      results: gradeResult.results || [],
      score: gradeResult.score || 0,
      maxScore: gradeResult.max_score || 0,
      passed: gradeResult.passed || 0,
      total: gradeResult.total || 0,
      allPassed: gradeResult.all_passed || false,
      attempt: prevCount + 1
    });

    res.json({
      ...submission.toObject(),
      compile_error: gradeResult.compile_error || '',
      engine_used: gradeResult.engine_used || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/labs/:id/submissions — Faculty: all submissions for a lab
router.get('/:id/submissions', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    const subs = await LabSubmission.find({ lab: req.params.id })
      .populate('student', 'fullName username enrollmentNo')
      .sort({ submittedAt: -1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/labs/:id/my-submissions — Student: own submissions
router.get('/:id/my-submissions', verifyToken, async (req, res) => {
  try {
    const subs = await LabSubmission.find({
      lab: req.params.id, student: req.user.id
    }).sort({ submittedAt: -1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
