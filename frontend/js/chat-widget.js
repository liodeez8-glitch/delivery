/**
 * CAC Couriers — Live Chat Widget
 * chat-widget.js  ·  Drop this file into js/ and add one <script> tag
 *
 * HOW TO ADD TO ANY PAGE:
 *   1. Place this file at:  js/chat-widget.js
 *   2. Before </body> add:
 *        <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
 *        <script src="js/chat-widget.js"></script>
 *
 * CONFIG: Edit BACKEND_URL below to match your server.
 */

(function () {
  'use strict';

  /* ── CONFIG ────────────────────────────────────────────── */
  // const BACKEND_URL  = (typeof window !== 'undefined' && window.CAC_BACKEND_URL)
  //   ? window.CAC_BACKEND_URL.replace(/\/$/, '')
  //   : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3010');

  const BACKEND_URL =
  (typeof window !== 'undefined' && window.CAC_BACKEND_URL)
    ? window.CAC_BACKEND_URL.replace(//$/, '')
    : window.location.origin;

    console.log('CAC Chat Widget: Using backend URL:', BACKEND_URL);
  const WIDGET_TITLE = 'CAC Support';
  const WIDGET_SUB   = 'We reply within minutes';
  const BOT_GREETING = "Hello! 👋 Welcome to CAC Couriers. How can we help you today?\n\nYou can ask us about your shipment, our services, or anything else.";

  /* ── SESSION ID ─────────────────────────────────────────── */
  // Persists across page loads within the same browser
  let sessionId = sessionStorage.getItem('cac_chat_session');
  if (!sessionId) {
    sessionId = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem('cac_chat_session', sessionId);
  }

  let visitorName  = sessionStorage.getItem('cac_chat_name') || '';
  let socket       = null;
  let isOpen       = false;
  let isConnecting = false;
  let unreadCount  = 0;
  let hasGreeted   = false;
  let typingTimer  = null;
  let adminTyping  = false;

  /* ══════════════════════════════════════════════════════════
     BUILD THE WIDGET DOM
  ══════════════════════════════════════════════════════════ */
  function buildWidget() {
    /* ── Inject fonts if not already on page ── */
    if (!document.querySelector('link[href*="Barlow+Condensed"]')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap';
      document.head.appendChild(link);
    }

    /* ── Inject CSS ──────────────────────────── */
    const style = document.createElement('style');
    style.textContent = `
      /* ── CAC Chat Widget ──────────────────────────────────── */
      :root {
        --cac-red:        #D0201A;
        --cac-red-dk:     #A51410;
        --cac-red-glow:   rgba(208,32,26,0.18);
        --cac-navy:       #0B1A2E;
        --cac-navy-lt:    #112236;
        --cac-steel:      #1A3050;
        --cac-steel-lt:   #243F60;
        --cac-white:      #FFFFFF;
        --cac-muted:      #7A90AB;
        --cac-border:     rgba(255,255,255,0.08);
        --cac-border-lt:  rgba(255,255,255,0.14);
        --cac-gold:       #E8A020;
        --cac-green:      #22C55E;
        --cac-font-d:     'Barlow Condensed', sans-serif;
        --cac-font-b:     'DM Sans', sans-serif;
        --cac-w:          360px;
        --cac-h:          520px;
        --cac-r:          14px;
        --cac-ease:       0.25s cubic-bezier(0.34,1.56,0.64,1);
        --cac-ease-fast:  0.15s ease;
      }

      /* ── FAB BUTTON ───────────────────────────────────────── */
      #cac-fab {
        position: fixed;
        bottom: 28px;
        left: 28px;
        z-index: 9000;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--cac-red);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px rgba(208,32,26,0.55), 0 2px 8px rgba(0,0,0,0.3);
        animation: cacBounce 2.8s ease-in-out 1.5s infinite;
        transition: transform var(--cac-ease-fast), background var(--cac-ease-fast), box-shadow var(--cac-ease-fast);
      }
      #cac-fab:hover {
        background: var(--cac-red-dk);
        box-shadow: 0 12px 40px rgba(208,32,26,0.7), 0 4px 16px rgba(0,0,0,0.4);
        transform: scale(1.08);
        animation: none;
      }
      #cac-fab:active { transform: scale(0.96); }
      #cac-fab.open   { animation: none; }

      /* FAB pulse ring */
      #cac-fab::before {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px solid rgba(208,32,26,0.4);
        animation: cacRingPulse 2.8s ease-out 1.5s infinite;
        pointer-events: none;
      }
      #cac-fab.open::before { display: none; }

      @keyframes cacBounce {
        0%,100%  { transform: translateY(0); }
        10%      { transform: translateY(-10px); }
        20%      { transform: translateY(0); }
        30%      { transform: translateY(-5px); }
        40%      { transform: translateY(0); }
      }
      @keyframes cacRingPulse {
        0%   { transform: scale(1);   opacity: 0.8; }
        70%  { transform: scale(1.4); opacity: 0; }
        100% { transform: scale(1.4); opacity: 0; }
      }

      /* FAB icon transitions */
      #cac-fab .cac-icon-chat,
      #cac-fab .cac-icon-close {
        position: absolute;
        transition: opacity 0.2s ease, transform 0.25s ease;
        pointer-events: none;
      }
      #cac-fab .cac-icon-close {
        opacity: 0;
        transform: rotate(-45deg) scale(0.7);
      }
      #cac-fab.open .cac-icon-chat {
        opacity: 0;
        transform: rotate(45deg) scale(0.7);
      }
      #cac-fab.open .cac-icon-close {
        opacity: 1;
        transform: rotate(0deg) scale(1);
      }

      /* ── UNREAD BADGE ─────────────────────────────────────── */
      #cac-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        background: var(--cac-gold);
        color: var(--cac-navy);
        border-radius: 10px;
        font-family: var(--cac-font-d);
        font-size: 11px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        border: 2px solid var(--cac-navy);
        opacity: 0;
        transform: scale(0.5);
        transition: opacity 0.2s, transform 0.2s var(--cac-ease);
        pointer-events: none;
      }
      #cac-badge.show {
        opacity: 1;
        transform: scale(1);
      }

      /* ── CHAT WINDOW ──────────────────────────────────────── */
      #cac-window {
        position: fixed;
        bottom: 104px;
        left: 28px;
        z-index: 8999;
        width: var(--cac-w);
        height: var(--cac-h);
        background: var(--cac-navy-lt);
        border: 1px solid var(--cac-border-lt);
        border-radius: var(--cac-r);
        box-shadow: 0 24px 72px rgba(0,0,0,0.65), 0 8px 24px rgba(208,32,26,0.12);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.28s ease, transform 0.28s var(--cac-ease);
      }
      #cac-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* Accent stripe at top */
      #cac-window::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, var(--cac-red), transparent);
        z-index: 1;
        border-radius: var(--cac-r) var(--cac-r) 0 0;
      }

      /* ── HEADER ───────────────────────────────────────────── */
      #cac-header {
        background: linear-gradient(135deg, var(--cac-navy) 0%, var(--cac-steel) 100%);
        border-bottom: 1px solid var(--cac-border);
        padding: 16px 18px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
      }
      #cac-header::after {
        content: '';
        position: absolute;
        bottom: 0; right: 0;
        width: 80px; height: 80px;
        border-radius: 50%;
        background: var(--cac-red-glow);
        transform: translate(30px, 30px);
      }
      .cac-header-logo {
        width: 42px;
        height: 42px;
        background: var(--cac-red);
        clip-path: polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .cac-header-logo svg { color: #fff; }
      .cac-header-text { flex: 1; min-width: 0; }
      .cac-header-title {
        font-family: var(--cac-font-d);
        font-size: 18px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--cac-white);
        line-height: 1;
      }
      .cac-header-sub {
        font-size: 11px;
        color: var(--cac-muted);
        margin-top: 3px;
        letter-spacing: 0.02em;
      }
      #cac-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #666;
        flex-shrink: 0;
        transition: background 0.3s;
        box-shadow: 0 0 0 3px rgba(100,100,100,0.2);
      }
      #cac-status-dot.online {
        background: var(--cac-green);
        box-shadow: 0 0 0 3px rgba(34,197,94,0.25);
        animation: cacStatusPulse 2s infinite;
      }
      @keyframes cacStatusPulse {
        0%,100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
        50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0.08); }
      }

      /* ── MESSAGES AREA ────────────────────────────────────── */
      #cac-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
      }
      #cac-messages::-webkit-scrollbar { width: 4px; }
      #cac-messages::-webkit-scrollbar-track { background: transparent; }
      #cac-messages::-webkit-scrollbar-thumb { background: var(--cac-steel); border-radius: 2px; }

      /* ── MESSAGE BUBBLES ──────────────────────────────────── */
      .cac-msg-group {
        display: flex;
        flex-direction: column;
        max-width: 80%;
        gap: 3px;
        animation: cacMsgIn 0.22s ease;
      }
      @keyframes cacMsgIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .cac-msg-group.visitor { align-self: flex-end; align-items: flex-end; }
      .cac-msg-group.admin   { align-self: flex-start; align-items: flex-start; }

      .cac-bubble {
        padding: 9px 13px;
        border-radius: 12px;
        font-family: var(--cac-font-b);
        font-size: 13px;
        line-height: 1.55;
        word-break: break-word;
      }
      .visitor .cac-bubble {
        background: var(--cac-red);
        color: #fff;
        border-bottom-right-radius: 3px;
      }
      .admin .cac-bubble {
        background: var(--cac-steel);
        color: var(--cac-white);
        border-bottom-left-radius: 3px;
        border: 1px solid var(--cac-border-lt);
      }

      .cac-msg-sender {
        font-family: var(--cac-font-d);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--cac-muted);
        padding: 0 4px;
      }
      .cac-msg-time {
        font-size: 10px;
        color: rgba(122,144,171,0.6);
        padding: 0 4px;
      }

      /* ── TYPING INDICATOR ─────────────────────────────────── */
      #cac-typing {
        display: none;
        align-self: flex-start;
        align-items: center;
        gap: 5px;
        padding: 8px 12px;
        background: var(--cac-steel);
        border: 1px solid var(--cac-border-lt);
        border-radius: 12px;
        border-bottom-left-radius: 3px;
        margin-bottom: 2px;
      }
      #cac-typing.show { display: flex; }
      .cac-typing-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--cac-muted);
      }
      .cac-typing-dot:nth-child(1) { animation: cacDot 1.2s 0.0s infinite; }
      .cac-typing-dot:nth-child(2) { animation: cacDot 1.2s 0.2s infinite; }
      .cac-typing-dot:nth-child(3) { animation: cacDot 1.2s 0.4s infinite; }
      @keyframes cacDot {
        0%,80%,100% { transform: translateY(0); opacity: 0.4; }
        40%          { transform: translateY(-5px); opacity: 1; }
      }

      /* ── NAME SCREEN ──────────────────────────────────────── */
      #cac-name-screen {
        position: absolute;
        inset: 0;
        background: var(--cac-navy-lt);
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 28px;
        text-align: center;
        transition: opacity 0.3s, transform 0.3s;
      }
      #cac-name-screen.hidden {
        opacity: 0;
        transform: scale(0.97);
        pointer-events: none;
      }
      .cac-name-icon {
        width: 64px; height: 64px;
        background: var(--cac-red-glow);
        border: 1.5px solid rgba(208,32,26,0.3);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: var(--cac-red);
        margin: 0 auto 20px;
      }
      .cac-name-title {
        font-family: var(--cac-font-d);
        font-size: 26px; font-weight: 800;
        text-transform: uppercase; letter-spacing: 0.02em;
        color: var(--cac-white);
        margin-bottom: 8px;
      }
      .cac-name-title em { color: var(--cac-red); font-style: normal; }
      .cac-name-sub {
        font-size: 13px; color: var(--cac-muted);
        line-height: 1.6; margin-bottom: 24px;
      }
      #cac-name-input {
        width: 100%;
        background: var(--cac-navy);
        border: 1.5px solid var(--cac-border-lt);
        border-radius: 8px;
        color: var(--cac-white);
        padding: 12px 16px;
        font-family: var(--cac-font-b);
        font-size: 14px;
        margin-bottom: 12px;
        transition: border-color 0.15s;
        box-sizing: border-box;
      }
      #cac-name-input:focus {
        outline: none;
        border-color: var(--cac-red);
        box-shadow: 0 0 0 3px rgba(208,32,26,0.18);
      }
      #cac-name-input::placeholder { color: var(--cac-muted); }
      #cac-name-btn {
        width: 100%;
        background: var(--cac-red);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 12px 20px;
        font-family: var(--cac-font-d);
        font-size: 14px; font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: background 0.15s, transform 0.15s;
        clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
      }
      #cac-name-btn:hover { background: var(--cac-red-dk); transform: translateX(2px); }
      #cac-name-err {
        font-size: 11px; color: #ff6b6b; margin-top: 6px;
        display: none;
      }

      /* ── INPUT BAR ────────────────────────────────────────── */
      #cac-input-bar {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--cac-border);
        background: rgba(0,0,0,0.15);
        flex-shrink: 0;
      }
      #cac-input {
        flex: 1;
        background: var(--cac-navy);
        border: 1.5px solid var(--cac-border-lt);
        border-radius: 22px;
        color: var(--cac-white);
        padding: 10px 16px;
        font-family: var(--cac-font-b);
        font-size: 13px;
        resize: none;
        min-height: 40px;
        max-height: 100px;
        line-height: 1.5;
        transition: border-color 0.15s;
        box-sizing: border-box;
      }
      #cac-input:focus {
        outline: none;
        border-color: var(--cac-red);
      }
      #cac-input::placeholder { color: var(--cac-muted); }
      #cac-send {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: var(--cac-red);
        border: none;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        color: #fff;
        transition: background 0.15s, transform 0.15s;
        box-shadow: 0 4px 12px rgba(208,32,26,0.4);
      }
      #cac-send:hover { background: var(--cac-red-dk); transform: scale(1.08); }
      #cac-send:active { transform: scale(0.95); }
      #cac-send:disabled { background: var(--cac-steel); box-shadow: none; cursor: not-allowed; }

      /* ── CONNECTING / OFFLINE STATE ───────────────────────── */
      #cac-conn-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 14px;
        font-size: 11px;
        font-family: var(--cac-font-b);
        color: var(--cac-muted);
        background: rgba(0,0,0,0.2);
        border-bottom: 1px solid var(--cac-border);
        flex-shrink: 0;
        display: none;
      }
      #cac-conn-bar.show { display: flex; }
      .cac-conn-spinner {
        width: 12px; height: 12px;
        border-radius: 50%;
        border: 2px solid rgba(122,144,171,0.3);
        border-top-color: var(--cac-muted);
        animation: cacSpin 0.7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes cacSpin { to { transform: rotate(360deg); } }

      /* ── SYSTEM MESSAGE ───────────────────────────────────── */
      .cac-sys-msg {
        align-self: center;
        font-size: 10px;
        color: var(--cac-muted);
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--cac-border);
        padding: 4px 10px;
        border-radius: 100px;
        letter-spacing: 0.06em;
      }

      /* ── OFFLINE / ERROR ──────────────────────────────────── */
      #cac-offline-msg {
        display: none;
        text-align: center;
        padding: 12px 16px;
        font-size: 12px;
        color: #ff9999;
        background: rgba(229,57,53,0.08);
        border-top: 1px solid rgba(229,57,53,0.2);
        flex-shrink: 0;
      }
      #cac-offline-msg.show { display: block; }

      /* ── DARK OVERLAY (mobile) ────────────────────────────── */
      #cac-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 8998;
        backdrop-filter: blur(2px);
      }

      /* ── RESPONSIVE ───────────────────────────────────────── */
      @media (max-width: 480px) {
        #cac-window {
          left: 0; right: 0; bottom: 0;
          width: 100%;
          height: 85vh;
          border-radius: var(--cac-r) var(--cac-r) 0 0;
        }
        #cac-fab { bottom: 20px; left: 20px; }
        #cac-overlay { display: block; opacity: 0; transition: opacity 0.28s; pointer-events: none; }
        #cac-overlay.show { opacity: 1; pointer-events: all; }
      }
    `;
    document.head.appendChild(style);

    /* ── FAB button ─────────────────────────────────────────── */
    const fab = document.createElement('button');
    fab.id = 'cac-fab';
    fab.setAttribute('aria-label', 'Open live chat');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = `
      <span class="cac-icon-chat" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </span>
      <span class="cac-icon-close" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>
      <span id="cac-badge" aria-live="polite" aria-atomic="true">0</span>
    `;

    /* ── Chat window ────────────────────────────────────────── */
    const win = document.createElement('div');
    win.id = 'cac-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'false');
    win.setAttribute('aria-label', 'Live chat window');
    win.innerHTML = `
      <!-- NAME SCREEN -->
      <div id="cac-name-screen">
        <div class="cac-name-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="cac-name-title">Start <em>Chatting</em></div>
        <p class="cac-name-sub">Enter your name so our team knows who they're speaking with.</p>
        <input type="text" id="cac-name-input" placeholder="Your name…" maxlength="40" autocomplete="name"/>
        <div id="cac-name-err">Please enter your name to continue.</div>
        <button id="cac-name-btn">
          Start Chat
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- HEADER -->
      <div id="cac-header">
        <div class="cac-header-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
            <rect x="1" y="3" width="15" height="13" rx="1"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div class="cac-header-text">
          <div class="cac-header-title">${WIDGET_TITLE}</div>
          <div class="cac-header-sub">${WIDGET_SUB}</div>
        </div>
        <div id="cac-status-dot" title="Connecting…"></div>
      </div>

      <!-- CONNECTING BAR -->
      <div id="cac-conn-bar">
        <div class="cac-conn-spinner"></div>
        Connecting to support…
      </div>

      <!-- MESSAGES -->
      <div id="cac-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>

      <!-- TYPING -->
      <div id="cac-typing" aria-label="Support agent is typing">
        <div class="cac-typing-dot"></div>
        <div class="cac-typing-dot"></div>
        <div class="cac-typing-dot"></div>
      </div>

      <!-- OFFLINE MSG -->
      <div id="cac-offline-msg">
        ⚠ Connection lost — trying to reconnect…
      </div>

      <!-- INPUT BAR -->
      <div id="cac-input-bar">
        <textarea id="cac-input" placeholder="Type a message…" rows="1"
          aria-label="Message input" maxlength="1000"></textarea>
        <button id="cac-send" aria-label="Send message" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    `;

    /* ── Mobile overlay ─────────────────────────────────────── */
    const overlay = document.createElement('div');
    overlay.id = 'cac-overlay';
    overlay.addEventListener('click', closeChat);

    document.body.appendChild(overlay);
    document.body.appendChild(win);
    document.body.appendChild(fab);

    /* ── Wire up events ──────────────────────────────────────── */
    fab.addEventListener('click', toggleChat);

    document.getElementById('cac-name-btn').addEventListener('click', submitName);
    document.getElementById('cac-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitName(); }
    });

    const input   = document.getElementById('cac-input');
    const sendBtn = document.getElementById('cac-send');

    input.addEventListener('input', () => {
      // Auto-grow textarea
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      sendBtn.disabled = input.value.trim().length === 0;
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener('click', sendMessage);

    // If name already saved from previous session, skip name screen
    if (visitorName) showChat();
  }

  /* ══════════════════════════════════════════════════════════
     SOCKET.IO CONNECTION
  ══════════════════════════════════════════════════════════ */
  function connectSocket() {
    if (socket?.connected || isConnecting) return;
    isConnecting = true;

    // Guard: Socket.io must be loaded
    if (typeof io === 'undefined') {
      console.warn('[CAC Chat] Socket.io not loaded. Add the CDN script before chat-widget.js');
      showOffline();
      return;
    }

    setConnBar(true);

    socket = io(BACKEND_URL, {
      auth: {
        role:        'visitor',
        sessionId:   sessionId,
        visitorName: visitorName,
      },
      transports:        ['websocket', 'polling'],
      reconnection:      true,
      reconnectionDelay: 1500,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      isConnecting = false;
      setConnBar(false);
      setStatusDot(true);
      hideOffline();
      document.getElementById('cac-send').disabled =
        document.getElementById('cac-input').value.trim().length === 0;

      if (!hasGreeted) {
        hasGreeted = true;
        setTimeout(() => appendAdminBubble('CAC Support', BOT_GREETING, new Date().toISOString()), 600);
      }
    });

    socket.on('disconnect', () => {
      setStatusDot(false);
      showOffline();
    });

    socket.on('connect_error', () => {
      isConnecting = false;
      setConnBar(false);
      setStatusDot(false);
      showOffline();
    });

    /* Admin reply */
    socket.on('admin-message', ({ senderName, message, timestamp }) => {
      hideTyping();
      appendAdminBubble(senderName || 'Support', message, timestamp);
      if (!isOpen) bumpBadge();
    });

    /* Admin typing */
    socket.on('admin-typing', () => {
      showTyping();
      clearTimeout(typingTimer);
      typingTimer = setTimeout(hideTyping, 3000);
    });

    /* History on reconnect */
    socket.on('chat-history', ({ messages }) => {
      const area = document.getElementById('cac-messages');
      area.innerHTML = '';
      hasGreeted = true;
      messages.forEach(m => {
        if (m.senderType === 'visitor') {
          appendVisitorBubble(m.message, m.createdAt);
        } else {
          appendAdminBubble(m.senderName || 'Support', m.message, m.createdAt);
        }
      });
      if (!messages.length) {
        hasGreeted = false; // will re-greet
        setTimeout(() => appendAdminBubble('CAC Support', BOT_GREETING, new Date().toISOString()), 600);
        hasGreeted = true;
      }
    });

    /* Echo of sent message confirmation */
    socket.on('message-sent', ({ message, timestamp }) => {
      // Already rendered optimistically — nothing to do
    });
  }

  /* ══════════════════════════════════════════════════════════
     OPEN / CLOSE
  ══════════════════════════════════════════════════════════ */
  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    document.getElementById('cac-window').classList.add('open');
    document.getElementById('cac-fab').classList.add('open');
    document.getElementById('cac-fab').setAttribute('aria-expanded', 'true');
    document.getElementById('cac-overlay').classList.add('show');
    resetBadge();
    scrollBottom();

    // If name is known, connect socket immediately
    if (visitorName) connectSocket();
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('cac-window').classList.remove('open');
    document.getElementById('cac-fab').classList.remove('open');
    document.getElementById('cac-fab').setAttribute('aria-expanded', 'false');
    document.getElementById('cac-overlay').classList.remove('show');
  }

  /* ── Skip to chat (after name entry) ─── */
  function showChat() {
    const screen = document.getElementById('cac-name-screen');
    screen.classList.add('hidden');
    setTimeout(() => { screen.style.display = 'none'; }, 300);
    document.getElementById('cac-input').focus();
  }

  /* ══════════════════════════════════════════════════════════
     NAME SCREEN
  ══════════════════════════════════════════════════════════ */
  function submitName() {
    const input  = document.getElementById('cac-name-input');
    const errEl  = document.getElementById('cac-name-err');
    const name   = input.value.trim();

    if (!name) {
      errEl.style.display = 'block';
      input.focus();
      return;
    }

    errEl.style.display = 'none';
    visitorName = name;
    sessionStorage.setItem('cac_chat_name', name);
    showChat();
    connectSocket();
    addSysMsg(`You're chatting as ${name}`);
  }

  /* ══════════════════════════════════════════════════════════
     SEND MESSAGE
  ══════════════════════════════════════════════════════════ */
  function sendMessage() {
    const input = document.getElementById('cac-input');
    const text  = input.value.trim();
    if (!text || !socket?.connected) return;

    socket.emit('visitor-message', {
      sessionId,
      visitorName,
      message: text,
    });

    appendVisitorBubble(text, new Date().toISOString());
    input.value  = '';
    input.style.height = 'auto';
    document.getElementById('cac-send').disabled = true;
  }

  /* ══════════════════════════════════════════════════════════
     RENDER MESSAGES
  ══════════════════════════════════════════════════════════ */
  function appendVisitorBubble(text, ts) {
    const area = document.getElementById('cac-messages');
    const grp  = document.createElement('div');
    grp.className = 'cac-msg-group visitor';
    grp.innerHTML = `
      <div class="cac-bubble">${escHtml(text)}</div>
      <div class="cac-msg-time">${fmtTime(ts)}</div>`;
    area.appendChild(grp);
    scrollBottom();
  }

  function appendAdminBubble(sender, text, ts) {
    const area = document.getElementById('cac-messages');
    const grp  = document.createElement('div');
    grp.className = 'cac-msg-group admin';
    grp.innerHTML = `
      <div class="cac-msg-sender">${escHtml(sender)}</div>
      <div class="cac-bubble">${escHtml(text).replace(/\n/g, '<br>')}</div>
      <div class="cac-msg-time">${fmtTime(ts)}</div>`;
    area.appendChild(grp);
    scrollBottom();
  }

  function addSysMsg(text) {
    const area = document.getElementById('cac-messages');
    const el   = document.createElement('div');
    el.className = 'cac-sys-msg';
    el.textContent = text;
    area.appendChild(el);
    scrollBottom();
  }

  /* ══════════════════════════════════════════════════════════
     UI STATE HELPERS
  ══════════════════════════════════════════════════════════ */
  function scrollBottom() {
    const area = document.getElementById('cac-messages');
    if (area) requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
  }

  function showTyping() {
    const t = document.getElementById('cac-typing');
    if (t) t.classList.add('show');
    scrollBottom();
  }
  function hideTyping() {
    const t = document.getElementById('cac-typing');
    if (t) t.classList.remove('show');
  }

  function setStatusDot(online) {
    const dot = document.getElementById('cac-status-dot');
    if (!dot) return;
    dot.classList.toggle('online', online);
    dot.title = online ? 'Support online' : 'Connecting…';
  }

  function setConnBar(show) {
    const bar = document.getElementById('cac-conn-bar');
    if (bar) bar.classList.toggle('show', show);
  }

  function showOffline() {
    document.getElementById('cac-offline-msg')?.classList.add('show');
    document.getElementById('cac-send').disabled = true;
    setConnBar(false);
  }
  function hideOffline() {
    document.getElementById('cac-offline-msg')?.classList.remove('show');
  }

  function bumpBadge() {
    unreadCount++;
    const badge = document.getElementById('cac-badge');
    badge.textContent = unreadCount;
    badge.classList.add('show');
  }
  function resetBadge() {
    unreadCount = 0;
    const badge = document.getElementById('cac-badge');
    badge.classList.remove('show');
  }

  /* ══════════════════════════════════════════════════════════
     TINY UTILS
  ══════════════════════════════════════════════════════════ */
  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;' }[c])
    );
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }

})();

// Chat container
const chatBox = document.getElementById('chatBoxMessages');

// Append a single message
function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('cw-bubble', sender); // 'visitor' or 'admin'
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // scroll to bottom
}

// Fetch all past messages from backend
async function loadAllMessages() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/chatmessages`); // replace with your endpoint
        const messages = await res.json();

        messages.forEach(msg => appendMessage(msg.text, msg.sender));
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', loadAllMessages);

// Poll for new messages every 2 seconds
let lastMessageId = null;
setInterval(async () => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/chatmessages`);
        const messages = await res.json();

        messages.forEach(msg => {
            if(msg._id !== lastMessageId) {
                appendMessage(msg.text, msg.sender);
                lastMessageId = msg._id;
            }
        });
    } catch (err) {
        console.error('Error fetching new messages:', err);
    }
}, 2000);

// Send a new message (visitor example)
async function sendVisitorMessage(text) {
    appendMessage(text, 'visitor'); // show instantly
    try {
        await fetch(`${BACKEND_URL}/api/chatmessages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sender: 'visitor' })
        });
    } catch (err) {
        console.error('Error sending message:', err);
    }
}

// Send a new message (admin example)
async function sendAdminMessage(text) {
    appendMessage(text, 'admin'); // show instantly
    try {
        await fetch(`${BACKEND_URL}/api/admin/chatmessages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sender: 'admin' })
        });
    } catch (err) {
        console.error('Error sending admin message:', err);
    }
}