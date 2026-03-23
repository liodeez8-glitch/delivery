'use strict';
const express  = require('express');
const Shipment = require('../models/Shipment');
const router   = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { trackingCode, transportMode } = req.body;
    if (!trackingCode || String(trackingCode).trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Please provide a valid tracking code.' });
    }

    const query = { trackingCode: String(trackingCode).trim().toUpperCase() };
    if (transportMode) query.transportMode = transportMode;

    // Exclude financial/admin fields from public response
    const shipment = await Shipment.findOne(query)
      .select('-shippingFee -currency -adminNotes');

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found. Please check your tracking code.' });
    }

    res.json({ success: true, shipment });
  } catch (err) { next(err); }
});

module.exports = router;
