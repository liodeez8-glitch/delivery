'use strict';
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  phone:   { type: String, trim: true },
  subject: { type: String, trim: true },
  message: { type: String, required: true, trim: true },
  read:    { type: Boolean, default: false },
  ip:      { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
