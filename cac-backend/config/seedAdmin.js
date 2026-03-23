'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const Admin    = require('../models/Admin');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const email    = process.env.ADMIN_EMAIL    || 'admin@test.com';
  const password = process.env.ADMIN_PASSWORD || 'AdminRG';
  const exists   = await Admin.findOne({ email });
  if (exists) {
    console.log(`Admin already exists: ${email}`);
  } else {
    await new Admin({ username: 'admin_user', email, password }).save();
    console.log(`✅ Admin created: ${email}`);
  }
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
