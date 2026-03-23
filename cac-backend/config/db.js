'use strict';
const mongoose = require('mongoose');

function validateMongoUri(uri) {
  const s = String(uri || '').trim();
  if (!s) throw new Error('Missing MONGO_URI environment variable');

  if (s.startsWith('mongodb+srv://')) {
    const authority = s.slice('mongodb+srv://'.length).split('/')[0] || '';
    const atCount = (authority.match(/@/g) || []).length;
    if (atCount > 1) {
      throw new Error('Invalid mongodb+srv URI: URL-encode "@" in username/password (use %40).');
    }

    const hostPort = authority.includes('@') ? authority.split('@').pop() : authority;
    if (hostPort.includes(':')) {
      throw new Error('Invalid mongodb+srv URI: remove the port from the hostname.');
    }
  }
}

function connectDB() {
  const uri = process.env.MONGO_URI;

  try {
    validateMongoUri(uri);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
    return Promise.reject(err);
  }

  return mongoose.connect(uri)
    .then(() => {
      console.log('✅ MongoDB connected');
    })
    .catch((err) => {
      console.error('❌ MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = connectDB;
