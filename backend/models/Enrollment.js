const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  since:   { type: Date, default: Date.now }
});

enrollmentSchema.index({ student: 1, faculty: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
