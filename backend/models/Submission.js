const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  exam:       { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  sessionId:  { type: String, required: true },
  answers:    { type: Map, of: String },
  score:      { type: Number, default: 0 },
  integrity:  {
    behavioralScore: Number,
    pastePenalty:    Number,
    integrityScore:  Number,
    grade:           { type: String, enum: ['High', 'Suspicious', 'Flagged'] }
  },
  avgConfidence: Number,
  cpCount:       { type: Number, default: 0 },
  submittedAt:   { type: Date, default: Date.now }
});

submissionSchema.index({ student: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
