const mongoose = require('mongoose');

const authLogSchema = new mongoose.Schema({
  username:   { type: String, required: true, index: true },
  sessionId:  { type: String, required: true, index: true },
  confidence: { type: Number, required: true },
  status:     { type: String, enum: ['Verified', 'Warning', 'Flagged'] },
  engine:     { type: String, default: 'continuous' },
  timestamp:  { type: Date, default: Date.now }
});

authLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days TTL

module.exports = mongoose.model('AuthLog', authLogSchema);
