const mongoose = require('mongoose');

const copyPasteLogSchema = new mongoose.Schema({
  username:   { type: String, required: true },
  sessionId:  { type: String, required: true },
  eventType:  { type: String, default: 'paste' },
  questionId: { type: String },
  chars:      { type: Number, default: 0 },
  timestamp:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('CopyPasteLog', copyPasteLogSchema);
