const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const AuthLog = require('../models/AuthLog');
const CopyPasteLog = require('../models/CopyPasteLog');
const Enrollment = require('../models/Enrollment');
const mlService = require('../services/ml.service');

const JWT_SECRET = process.env.JWT_SECRET || 'typeproctor-secret-key-2026';

module.exports = function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch { next(new Error('Auth error')); }
  });

  io.on('connection', (socket) => {
    const { role, username } = socket.user;
    console.log(`[Socket] ${role}:${username} connected`);

    if (role === 'faculty') {
      socket.join(`faculty:${socket.user.id}`);
    }

    // Student sends continuous auth check
    socket.on('auth:check', async (data) => {
      try {
        const features = data.features;
        const featureList = typeof features === 'object' && !Array.isArray(features)
          ? [features.mean_dwell, features.std_dwell, features.median_dwell, features.max_dwell,
             features.mean_flight, features.std_flight, features.median_flight, features.min_flight,
             features.typing_speed_wpm, features.dwell_flight_ratio,
             features.rhythm_consistency, features.total_time_ms, features.n_keys]
          : features;

        const result = await mlService.predict(featureList, username);

        // Save to DB
        await AuthLog.create({
          username, sessionId: data.sessionId,
          confidence: result.confidence, status: result.status
        });

        // Send back to student
        socket.emit('auth:result', result);

        // Send to faculty monitoring room
        const enrollment = await Enrollment.findOne({ student: socket.user.id });
        if (enrollment) {
          io.to(`faculty:${enrollment.faculty}`).emit('student:auth-update', {
            username, fullName: socket.user.fullName,
            confidence: result.confidence, status: result.status,
            sessionId: data.sessionId, timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error('[Socket] auth:check error:', err.message);
      }
    });

    // Copy-paste event
    socket.on('cp:event', async (data) => {
      try {
        await CopyPasteLog.create({
          username, sessionId: data.sessionId,
          eventType: data.eventType, questionId: data.questionId,
          chars: data.chars
        });
        const enrollment = await Enrollment.findOne({ student: socket.user.id });
        if (enrollment) {
          io.to(`faculty:${enrollment.faculty}`).emit('student:cp-alert', {
            username, ...data, timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error('[Socket] cp:event error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${role}:${username} disconnected`);
    });
  });

  return io;
};
