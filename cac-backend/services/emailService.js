'use strict';

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.EMAIL_USER || process.env.MAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    const missing = [
      !user ? 'EMAIL_USER' : null,
      !pass ? 'EMAIL_PASS' : null,
    ].filter(Boolean).join(', ');
    throw new Error(`Missing email configuration: ${missing}`);
  }

  const host = process.env.MAIL_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 587);
  const secure = String(process.env.MAIL_SECURE || '').toLowerCase() === 'true' || port === 465;

  _transporter = host
    ? nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    : nodemailer.createTransport({ service: process.env.EMAIL_SERVICE || 'gmail', auth: { user, pass } });

  return _transporter;
}

function getFromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.MAIL_USER || process.env.SMTP_USER;
}

async function sendMail({ to, subject, text, html, replyTo }) {
  const transporter = getTransporter();
  const from = getFromAddress();
  if (!from) throw new Error('Missing email sender address (SMTP_FROM or SMTP_USER)');
  if (!to) throw new Error('Missing recipient email');

  const info = await transporter.sendMail({
    from,
    to,
    subject: subject || 'CAC Couriers',
    text,
    html,
    replyTo,
  });

  return info;
}

function buildTrackingLink(trackingCode) {
  const base = (process.env.TRACKING_LINK_BASE || 'https://yourdomain.com/track/').trim();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}${encodeURIComponent(String(trackingCode || '').trim())}`;
}

function shipmentConfirmationEmail({ recipientName, trackingCode }) {
  const name = recipientName || 'Customer';
  const link = buildTrackingLink(trackingCode);

  const subject = 'CAC Couriers Shipment Confirmation';
  const text = [
    `Hello ${name},`,
    '',
    'Your shipment has been created successfully.',
    `Tracking code: ${trackingCode}`,
    `Track here: ${link}`,
    '',
    'Thank you,',
    'CAC Couriers & Shipping Company',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0B1A2E">
      <p>Hello ${escapeHtml(name)},</p>
      <p>Your shipment has been created successfully.</p>
      <p><strong>Tracking code:</strong> ${escapeHtml(trackingCode)}</p>
      <p><strong>Track here:</strong> <a href="${link}">${link}</a></p>
      <p>Thank you,<br/>CAC Couriers &amp; Shipping Company</p>
    </div>
  `;

  return { subject, text, html };
}

async function sendShipmentEmail(to, customerName, trackingCode) {
  const tpl = shipmentConfirmationEmail({ recipientName: customerName, trackingCode });
  return sendMail({ to, subject: tpl.subject, text: tpl.text, html: tpl.html });
}

async function sendContactEmail(contact) {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || process.env.MAIL_USER || process.env.SMTP_USER;
  if (!to) throw new Error('Missing admin notify email (ADMIN_NOTIFY_EMAIL)');

  const name = contact?.name || 'Visitor';
  const fromEmail = contact?.email || '';
  const phone = contact?.phone || '';
  const subjectLine = contact?.subject || 'Contact Message';
  const message = contact?.message || '';

  const subject = `New Contact Message — ${subjectLine}`;
  const text = [
    `Name: ${name}`,
    `Email: ${fromEmail}`,
    phone ? `Phone: ${phone}` : null,
    '',
    message,
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0B1A2E">
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(fromEmail)}</p>
      ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
      <p><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>
      <hr/>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    </div>
  `;

  return sendMail({ to, subject, text, html, replyTo: fromEmail || undefined });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  sendMail,
  sendShipmentEmail,
  sendContactEmail,
  shipmentConfirmationEmail,
  buildTrackingLink,
};
