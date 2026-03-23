'use strict';
const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  trackingCode:      { type: String, unique: true, uppercase: true, trim: true },
  transportMode:     { type: String, enum: ['air','sea','land'], required: true },
  shippingStatus:    { type: String, enum: ['processing','in_transit','out_for_delivery','delivered','on_hold','cancelled'], default: 'processing' },

  senderName:        { type: String, trim: true },
  senderPhone:       { type: String, trim: true },
  senderAddress:     { type: String, trim: true },
  senderEmail:       { type: String, trim: true, lowercase: true },

  recipientName:     { type: String, required: true, trim: true },
  recipientPhone:    { type: String, trim: true },
  recipientAddress:  { type: String, required: true, trim: true },
  recipientEmail:    { type: String, trim: true, lowercase: true },

  packageContent:    { type: String, trim: true },
  packageWeight:     { type: Number, min: 0 },
  packageQuantity:   { type: Number, min: 1, default: 1 },
  packageDimensions: { type: String, trim: true },

  origin:            { type: String, trim: true },
  destination:       { type: String, trim: true },
  currentLocation:   { type: String, trim: true },

  shipmentDate:      { type: Date },
  arrivalDate:       { type: Date },

  shippingFee:       { type: Number, min: 0, select: false },
  currency:          { type: String, default: 'USD', select: false },
  adminNotes:        { type: String, trim: true, select: false },
}, { timestamps: true });

// Auto-generate tracking code
shipmentSchema.pre('save', async function (next) {
  if (this.trackingCode) return next();
  const year   = new Date().getFullYear();
  const mode   = (this.transportMode || 'air').toUpperCase().slice(0, 3);
  const count  = await mongoose.model('Shipment').countDocuments();
  const pad    = String(count + 1).padStart(5, '0');
  this.trackingCode = `CAC-${year}-${mode}${pad}`;
  next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);
