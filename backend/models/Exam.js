const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  faculty:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:         { type: String, required: true },
  subject:       { type: String },
  date:          { type: String },
  startTime:     { type: String },
  durationMins:  { type: Number, required: true },
  instructions:  { type: String },
  questions:     [{ questionId: String, text: String, marks: Number, type: { type: String, default: 'text' } }],
  status:        { type: String, enum: ['upcoming', 'active', 'ended'], default: 'upcoming' },
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exam', examSchema);
