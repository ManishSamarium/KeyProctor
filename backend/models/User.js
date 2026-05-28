const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:      { type: String, required: true, unique: true, lowercase: true },
  passwordHash:  { type: String, required: true },
  fullName:      { type: String, required: true },
  role:          { type: String, enum: ['student', 'faculty'], required: true },
  courseName:    { type: String },
  enrollmentNo:  { type: String },
  enrolled:      { type: Boolean, default: false },
  keystrokeSamples: [{
    features: [Number],
    collectedAt: { type: Date, default: Date.now }
  }],
  refreshToken:  { type: String },
  createdAt:     { type: Date, default: Date.now }
});

userSchema.index({ username: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
