'use strict';
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const Admin          = require('./models/Admin');
const connectDB      = require('./config/db');
const errorHandler   = require('./middleware/errorHandler');
const trackingRoutes = require('./routes/trackingRoutes');
const contactRoutes  = require('./routes/contactRoutes');
const adminRoutes    = require('./routes/adminRoutes');

const app    = express();
const server = http.createServer(app);

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
    .split(',').map(o => o.trim()).filter(Boolean);
  return [...new Set([...DEV_ORIGINS, ...fromEnv])];
}

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin "${origin}" not allowed. Add it to FRONTEND_ORIGIN env var.`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
};

// OPTIONS preflight MUST come before other middleware
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

const io = new Server(server, {
  cors: {
    origin(origin, cb) { corsOptions.origin(origin, cb); },
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

const { initChat } = require('./services/chatService');
initChat(io);

async function ensureAdmin() {
  try {
    const email    = process.env.ADMIN_EMAIL    || 'admin@test.com';
    const password = process.env.ADMIN_PASSWORD || 'AdminRG';
    const exists   = await Admin.findOne({ email });
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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));
app.use('/api/track', rateLimit({
  windowMs: 5 * 60 * 1000, max: 30,
  message: { success: false, message: 'Too many tracking attempts. Please wait a few minutes.' },
}));

app.use('/admin', express.static(path.join(__dirname, 'admin/public')));
app.use(express.static(path.join(__dirname, '../frontend'), { extensions: ['html'] }));

app.use('/api/track',   trackingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin',   adminRoutes);

// ────────────────
// Healthcheck route
// ────────────────
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// ────────────────
// Catch-all for frontend and unknown API/admin paths
// ────────────────
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/admin')) {
    return res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\nCAC Couriers running on port ${PORT}`);
  console.log(`Allowed origins: ${getAllowedOrigins().join(', ')}\n`);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });;
