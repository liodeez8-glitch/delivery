'use strict';
const express  = require('express');
const Contact  = require('../models/Contact');
const { sendContactEmail } = require('../services/emailService');
const router   = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
    }

    const contact = await Contact.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : '',
      subject: subject ? String(subject).trim() : '',
      message: String(message).trim(),
      ip: req.ip,
    });

    // Fire email (non-blocking — don't fail request if email fails)
    sendContactEmail(contact).catch(err => console.warn('Email error:', err.message));

    res.status(201).json({ success: true, message: 'Your message has been received. We will get back to you shortly.' });
  } catch (err) { next(err); }
});

module.exports = router;
