const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
  faculty:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  course:      { type: String },
  deadline:    { type: String },
  description: { type: String },
  problems:    [{
    problemId:    String,
    title:        String,
    difficulty:   { type: String, default: 'Easy' },
    statement:    String,
    timeLimitS:   { type: Number, default: 3 },
    memoryLimitMb:{ type: Number, default: 64 },
    samples:      [{ input: String, output: String }],
    testCases:    [{ input: String, expected_output: String, points: Number }],
    starterCode:  String,
    totalPoints:  Number
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lab', labSchema);
