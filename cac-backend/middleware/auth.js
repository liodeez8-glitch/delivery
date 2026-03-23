'use strict';
const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorised — no token.' });
  }
  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin     = await Admin.findById(decoded.id);
    if (!req.admin) return res.status(401).json({ success: false, message: 'Admin not found.' });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
}

module.exports = { protect };
