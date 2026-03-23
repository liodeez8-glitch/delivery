'use strict';
const express  = require('express');
const jwt      = require('jsonwebtoken');
const Admin    = require('../models/Admin');
const Shipment = require('../models/Shipment');
const Contact  = require('../models/Contact');
const { sendShipmentEmail, sendMail } = require('../services/emailService');
const { protect } = require('../middleware/auth');
const router   = express.Router();

// ── LOGIN ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required.' });

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
    if (!admin || !(await admin.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ success: true, token, admin: { id: admin._id, email: admin.email, username: admin.username } });
  } catch (err) { next(err); }
});

// ── ME ─────────────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, admin: { id: req.admin._id, email: req.admin.email, username: req.admin.username } });
});

// ── STATS ──────────────────────────────────────────────────────────────
router.get('/stats', protect, async (req, res, next) => {
  try {
    const [total, inTransit, delivered, processing, unreadMessages] = await Promise.all([
      Shipment.countDocuments(),
      Shipment.countDocuments({ shippingStatus: { $in: ['in_transit', 'out_for_delivery'] } }),
      Shipment.countDocuments({ shippingStatus: 'delivered' }),
      Shipment.countDocuments({ shippingStatus: { $in: ['processing', 'on_hold'] } }),
      Contact.countDocuments({ read: false }),
    ]);
    res.json({ success: true, stats: { total, inTransit, delivered, processing, unreadMessages } });
  } catch (err) { next(err); }
});

// ── SHIPMENTS LIST ─────────────────────────────────────────────────────
router.get('/shipments', protect, async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const filter = {};

    if (req.query.status) filter.shippingStatus = req.query.status;
    if (req.query.mode)   filter.transportMode  = req.query.mode;
    if (req.query.search) {
      const rx = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ trackingCode: rx }, { recipientName: rx }, { packageContent: rx }, { origin: rx }, { destination: rx }];
    }

    const [shipments, total] = await Promise.all([
      Shipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('+shippingFee +currency +adminNotes'),
      Shipment.countDocuments(filter),
    ]);

    res.json({ success: true, shipments, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── CREATE SHIPMENT ────────────────────────────────────────────────────
router.post('/shipments', protect, async (req, res, next) => {
  try {
    const shipment = await Shipment.create(req.body);
    if (shipment?.recipientEmail) {
      sendShipmentEmail(shipment.recipientEmail, shipment.recipientName, shipment.trackingCode)
        .catch((err) => console.error('Shipment confirmation email failed:', err.message));
    }
    res.status(201).json({ success: true, shipment });
  } catch (err) { next(err); }
});

// ── GET SINGLE SHIPMENT ────────────────────────────────────────────────
router.get('/shipments/:id', protect, async (req, res, next) => {
  try {
    const shipment = await Shipment.findById(req.params.id).select('+shippingFee +currency +adminNotes');
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    res.json({ success: true, shipment });
  } catch (err) { next(err); }
});

// ── UPDATE SHIPMENT ────────────────────────────────────────────────────
router.put('/shipments/:id', protect, async (req, res, next) => {
  try {
    const shipment = await Shipment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    res.json({ success: true, shipment });
  } catch (err) { next(err); }
});

// ── DELETE SHIPMENT ────────────────────────────────────────────────────
router.delete('/shipments/:id', protect, async (req, res, next) => {
  try {
    const shipment = await Shipment.findByIdAndDelete(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    res.json({ success: true, message: 'Shipment deleted.' });
  } catch (err) { next(err); }
});

// ── CONTACTS LIST ──────────────────────────────────────────────────────
router.get('/contacts', protect, async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, contacts });
  } catch (err) { next(err); }
});

// ── MARK CONTACT READ ──────────────────────────────────────────────────
router.put('/contacts/:id/read', protect, async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });
    res.json({ success: true, contact });
  } catch (err) { next(err); }
});

router.post('/contacts/:id/reply', protect, async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });

    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Reply message is required.' });

    const finalSubject = subject || (contact.subject ? `Re: ${contact.subject}` : 'CAC Couriers Reply');

    await sendMail({
      to: contact.email,
      subject: finalSubject,
      text: message,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br/>')}</div>`,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
