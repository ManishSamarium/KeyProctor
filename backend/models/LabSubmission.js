const mongoose = require('mongoose');

const labSubmissionSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lab:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  problemId:  { type: String, required: true },
  code:       { type: String, required: true },
  language:   { type: String, default: 'cpp' },
  results:    [{
    input:     String,
    expected:  String,
    got:       String,
    points:    Number,
    awarded:   Number,
    status:    { type: String, enum: ['pass', 'fail', 'compile_error', 'runtime_error'] },
    stderr:    String,
    time_ms:   Number
  }],
  score:      { type: Number, default: 0 },
  maxScore:   { type: Number, default: 0 },
  passed:     { type: Number, default: 0 },
  total:      { type: Number, default: 0 },
  allPassed:  { type: Boolean, default: false },
  attempt:    { type: Number, default: 1 },
  submittedAt:{ type: Date, default: Date.now }
});

labSubmissionSchema.index({ student: 1, lab: 1, problemId: 1 });

module.exports = mongoose.model('LabSubmission', labSubmissionSchema);
