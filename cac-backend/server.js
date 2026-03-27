'use strict';
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const Admin = require('./models/Admin');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const trackingRoutes = require('./routes/trackingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

// Basic routes
app.get('/', (_req, res) => res.send('CAC Backend is running!'));
app.get('/health', (_req, res) => res.status(200).send('OK'));

// Allowed origins
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3010',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3010',
  'http://127.0.0.1:5500',
];

function getAllowedOrigins() {
  const fromEnv = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  return [...new Set([...DEV_ORIGINS, ...fromEnv])];
}

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Socket.IO
const io = new Server(server, {
  cors: {
    origin(origin, cb) { corsOptions.origin(origin, cb); },
    credentials: true,
  },
});

const { initChat } = require('./services/chatService');
initChat(io);

// Admin setup
async function ensureAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@test.com';
    const password = process.env.ADMIN_PASSWORD || 'AdminRG';

    const exists = await Admin.findOne({ email });

    if (!exists) {
      const admin = new Admin({ username: 'admin_user', email, password });
      await admin.save();
      console.log(`Admin created: ${email}`);
    } else {
      console.log(`Admin exists: ${email}`);
    }
  } catch (err) {
    console.error('Error ensuring admin:', err.message);
  }
}

connectDB().then(ensureAdmin);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

app.use('/api/track', rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
}));

// Static files
app.use('/admin', express.static(path.join(__dirname, 'admin/public')));
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api/track', trackingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/admin')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use(errorHandler);

// ✅ ONLY ONE SERVER START (IMPORTANT)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
