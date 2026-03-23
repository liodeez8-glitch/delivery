'use strict';
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sessionId:   { type: String, required: true, index: true },
  visitorName: { type: String, default: 'Visitor' },
  from:        { type: String, enum: ['visitor','admin'], required: true },
  message:     { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
