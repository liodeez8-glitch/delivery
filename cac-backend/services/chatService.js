'use strict';
const ChatMessage = require('../models/ChatMessage');

function initChat(io) {
  const adminSockets  = new Set();   // socket ids that are admin
  const activeSessions = new Map();  // sessionId → { visitorName, socketId }

  io.on('connection', (socket) => {

    // ── VISITOR joins their session ──────────────────────────────────
    socket.on('join-session', async ({ sessionId, visitorName }) => {
      if (!sessionId) return;
      socket.join(sessionId);
      activeSessions.set(sessionId, { visitorName: visitorName || 'Visitor', socketId: socket.id });

      // Notify all admins
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('visitor-joined', { sessionId, visitorName: visitorName || 'Visitor' });
      });

      // Send history to visitor
      try {
        const history = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).limit(100);
        socket.emit('chat-history', history);
      } catch (err) { console.error('chat history error:', err.message); }
    });

    // ── ADMIN joins ──────────────────────────────────────────────────
    socket.on('join-admin', () => {
      adminSockets.add(socket.id);
      socket.join('admin-room');

      // Send list of active sessions to admin
      const sessions = [];
      activeSessions.forEach((val, key) => sessions.push({ sessionId: key, ...val }));
      socket.emit('active-sessions', sessions);
    });

    // ── Admin requests history for a specific session ────────────────
    socket.on('get-history', async ({ sessionId }) => {
      try {
        const history = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).limit(100);
        socket.emit('chat-history', history);
      } catch (err) { console.error('get-history error:', err.message); }
    });

    // ── VISITOR sends message ────────────────────────────────────────
    socket.on('visitor-message', async ({ sessionId, message }) => {
      if (!sessionId || !message) return;
      const session     = activeSessions.get(sessionId) || {};
      const visitorName = session.visitorName || 'Visitor';

      try {
        const saved = await ChatMessage.create({ sessionId, visitorName, from: 'visitor', message: String(message).trim() });
        // Send to admins
        adminSockets.forEach(adminId => io.to(adminId).emit('new-message', saved));
        // Echo back to visitor session
        socket.to(sessionId).emit('new-message', saved);
      } catch (err) { console.error('visitor-message error:', err.message); }
    });

    // ── ADMIN sends message ──────────────────────────────────────────
    socket.on('admin-message', async ({ sessionId, message }) => {
      if (!sessionId || !message) return;
      const session     = activeSessions.get(sessionId) || {};
      const visitorName = session.visitorName || 'Visitor';

      try {
        const saved = await ChatMessage.create({ sessionId, visitorName, from: 'admin', message: String(message).trim() });
        // Send to the visitor session
        io.to(sessionId).emit('new-message', saved);
        // Echo to all other admins
        adminSockets.forEach(adminId => {
          if (adminId !== socket.id) io.to(adminId).emit('new-message', saved);
        });
      } catch (err) { console.error('admin-message error:', err.message); }
    });

    // ── DISCONNECT ───────────────────────────────────────────────────
    socket.on('disconnect', () => {
      adminSockets.delete(socket.id);
      // Find and clean up visitor session
      activeSessions.forEach((val, key) => {
        if (val.socketId === socket.id) {
          activeSessions.delete(key);
          adminSockets.forEach(adminId => io.to(adminId).emit('visitor-left', { sessionId: key }));
        }
      });
    });
  });
}

module.exports = { initChat };
