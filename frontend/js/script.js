'use strict';

// ─────────────────────────────────────────────────────
// BACKEND URL — production-safe
// Priority: window.CAC_BACKEND_URL env override → same origin (works when
// frontend & backend are served from the same Railway/Render deployment)
// ─────────────────────────────────────────────────────
const BACKEND_URL =
  (typeof window !== 'undefined' && window.CAC_BACKEND_URL)
    ? window.CAC_BACKEND_URL.replace(/\/$/, '')
    : window.location.origin;   // ✅ FIX 1: was hardcoded 'http://localhost:3010'

console.log('[CAC] Using backend URL:', BACKEND_URL);

// ─────────────────────────────────────────────────────
// Mobile nav
// ─────────────────────────────────────────────────────
const hamburgerButton = document.getElementById('hamburger');
const mobileNav       = document.getElementById('mobileNav');

if (hamburgerButton && mobileNav) {
  const mobileMq = window.matchMedia('(max-width: 680px)');

  const setMobileNavOpen = (open) => {
    hamburgerButton.classList.toggle('open', open);
    mobileNav.classList.toggle('open', open);
    hamburgerButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileNav.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const isMobileNavOpen = () => mobileNav.classList.contains('open');

  setMobileNavOpen(false);

  hamburgerButton.addEventListener('click', () => setMobileNavOpen(!isMobileNavOpen()));
  mobileNav.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) setMobileNavOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!isMobileNavOpen()) return;
    if (!(e.target instanceof Node)) return;
    if (mobileNav.contains(e.target) || hamburgerButton.contains(e.target)) return;
    setMobileNavOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isMobileNavOpen()) return;
    setMobileNavOpen(false);
    hamburgerButton.focus();
  });

  const handleBreakpointChange = () => {
    if (!mobileMq.matches && isMobileNavOpen()) setMobileNavOpen(false);
  };
  if (typeof mobileMq.addEventListener === 'function') {
    mobileMq.addEventListener('change', handleBreakpointChange);
  } else if (typeof mobileMq.addListener === 'function') {
    mobileMq.addListener(handleBreakpointChange);
  }
}

// ─────────────────────────────────────────────────────
// 1. TRACKING FORM
// ─────────────────────────────────────────────────────
const trackingForm = document.getElementById('trackingForm');
if (trackingForm) {
  trackingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = (document.getElementById('trackingNumber')?.value || '').trim().toUpperCase();
    const mode = document.getElementById('transportMode')?.value || '';
    if (!code) { alert('Please enter a tracking code.'); return; }
    const params = new URLSearchParams({ id: code });
    if (mode) params.set('mode', mode);
    window.location.href = `tracking-result.html?${params}`;
  });
}

// ─────────────────────────────────────────────────────
// 2. TRACKING RESULT PAGE
// ─────────────────────────────────────────────────────
const resultContainer = document.getElementById('resultContainer');
if (resultContainer) {
  const params       = new URLSearchParams(window.location.search);
  const trackingCode = params.get('id') || '';
  const mode         = params.get('mode') || '';

  if (!trackingCode) {
    resultContainer.innerHTML = errorHTML('No tracking code provided. Please go back and try again.');
  } else {
    loadTrackingResult(trackingCode, mode);
  }
}

async function loadTrackingResult(trackingCode, mode) {
  const container = document.getElementById('resultContainer');
  container.innerHTML = loadingHTML(trackingCode);

  try {
    // ✅ FIX 2: No credentials needed for public tracking — but Content-Type must be set
    const res  = await fetch(`${BACKEND_URL}/api/track`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ trackingCode, transportMode: mode }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      container.innerHTML = errorHTML(data.message || 'Shipment not found.');
      return;
    }
    container.innerHTML = renderShipmentCard(data.shipment);
  } catch (err) {
    console.error('Tracking error:', err);
    container.innerHTML = errorHTML(
      err.message.includes('Failed to fetch')
        ? 'Cannot reach the tracking server. Please try again later.'
        : err.message
    );
  }
}

function renderShipmentCard(s) {
  const statusLabel = {
    processing:       'Processing',
    in_transit:       'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered:        'Delivered',
    on_hold:          'On Hold',
    cancelled:        'Cancelled',
  }[s.shippingStatus] || s.shippingStatus;

  const statusClass = {
    processing:       'status-badge--processing',
    in_transit:       'status-badge--transit',
    out_for_delivery: 'status-badge--transit',
    delivered:        'status-badge--delivered',
    on_hold:          'status-badge--processing',
    cancelled:        'status-badge--processing',
  }[s.shippingStatus] || 'status-badge--processing';

  const progressMap = { processing:1, in_transit:2, out_for_delivery:2, delivered:3, on_hold:2, cancelled:1 };
  const progress = progressMap[s.shippingStatus] || 1;
  const stepState = (step) =>
    step < progress ? 'progress-step--done' : step === progress ? 'progress-step--active' : '';

  const checkIcon     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const clipboardIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="4" rx="1"/></svg>`;
  const truckIcon     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;
  const packageIcon   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.5V16a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8.5"/><path d="M21 8.5 12 3 3 8.5"/><path d="M12 22V12"/><path d="M21 8.5 12 13 3 8.5"/></svg>`;

  return `
    <div class="delivery-banner" role="status">
      <span class="delivery-banner__icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.686 2 6 4.686 6 8c0 5 6 12 6 12s6-7 6-12c0-3.314-2.686-6-6-6z"/><circle cx="12" cy="8.2" r="2.25"/></svg>
      </span>
      <p class="delivery-banner__text">
        Shipment <strong>${esc(s.trackingCode)}</strong> is currently
        <strong>${esc(statusLabel)}</strong>.
        Est. arrival: <strong>${fmtDate(s.arrivalDate)}</strong>.
      </p>
    </div>

    <div class="result-layout">
      <div class="result-card">
        <div class="result-card__header">
          <span class="result-card__title">Shipment Details</span>
          <span class="status-badge ${statusClass}"><span class="status-dot"></span>${esc(statusLabel)}</span>
        </div>
        <div class="result-card__body">
          <div class="result-row"><span class="result-row__key">Tracking ID</span><span class="result-row__val" style="color:var(--red)">${esc(s.trackingCode)}</span></div>
          <div class="result-row"><span class="result-row__key">Transport Mode</span><span class="result-row__val">${cap(s.transportMode)}</span></div>
          <div class="result-row"><span class="result-row__key">Content</span><span class="result-row__val">${esc(s.packageContent || '—')}</span></div>
          <div class="result-row"><span class="result-row__key">Weight</span><span class="result-row__val">${s.packageWeight ? s.packageWeight + ' kg' : '—'}</span></div>
          <div class="result-row"><span class="result-row__key">Quantity</span><span class="result-row__val">${s.packageQuantity ?? '—'}</span></div>
        </div>
      </div>
      <div class="result-card">
        <div class="result-card__header"><span class="result-card__title">Route Information</span></div>
        <div class="result-card__body">
          <div class="result-row"><span class="result-row__key">Origin</span><span class="result-row__val">${esc(s.origin || '—')}</span></div>
          <div class="result-row"><span class="result-row__key">Destination</span><span class="result-row__val">${esc(s.destination || '—')}</span></div>
          <div class="result-row"><span class="result-row__key">Current Location</span><span class="result-row__val">${esc(s.currentLocation || '—')}</span></div>
          <div class="result-row"><span class="result-row__key">Shipped</span><span class="result-row__val">${fmtDate(s.shipmentDate)}</span></div>
          <div class="result-row"><span class="result-row__key">Est. Arrival</span><span class="result-row__val" style="color:var(--gold)">${fmtDate(s.arrivalDate)}</span></div>
        </div>
      </div>
    </div>

    <div class="progress-tracker" role="region" aria-label="Shipment progress">
      <p class="progress-tracker__heading">Shipment Progress</p>
      <div class="progress-steps" data-progress="${progress}" role="list">
        <div class="progress-step ${stepState(1)}" role="listitem">
          <div class="progress-step__icon-wrap">${progress > 1 ? checkIcon : clipboardIcon}</div>
          <div><div class="progress-step__label">Processing</div><div class="progress-step__date">${fmtDate(s.shipmentDate)}</div></div>
        </div>
        <div class="progress-step ${stepState(2)}" role="listitem">
          <div class="progress-step__icon-wrap">${progress > 2 ? checkIcon : truckIcon}</div>
          <div><div class="progress-step__label">In Transit</div><div class="progress-step__date">${esc(s.currentLocation || '—')}</div></div>
        </div>
        <div class="progress-step ${stepState(3)}" role="listitem">
          <div class="progress-step__icon-wrap">${progress >= 3 ? checkIcon : packageIcon}</div>
          <div><div class="progress-step__label">Delivered</div><div class="progress-step__date">${fmtDate(s.arrivalDate)}</div></div>
        </div>
      </div>
    </div>

    <div class="result-card" style="margin-top:0">
      <div class="result-card__header"><span class="result-card__title">Recipient</span></div>
      <div class="result-card__body">
        <div class="result-row"><span class="result-row__key">Name</span><span class="result-row__val">${esc(s.recipientName)}</span></div>
        <div class="result-row"><span class="result-row__key">Address</span><span class="result-row__val">${esc(s.recipientAddress)}</span></div>
        <div class="result-row"><span class="result-row__key">Phone</span><span class="result-row__val">${esc(s.recipientPhone || '—')}</span></div>
      </div>
    </div>

    <div style="text-align:center;margin-top:var(--sp-lg)">
      <a href="tracking.html" class="btn btn-ghost-red">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Track Another Shipment
      </a>
    </div>`;
}

function loadingHTML(code) {
  return `<div class="tracking-loading"><p>Searching for <strong>${esc(code)}</strong>…</p></div>`;
}
function errorHTML(msg) {
  return `<div class="tracking-error"><p>⚠️ ${esc(msg)}</p><a href="javascript:history.back()">← Go Back</a></div>`;
}

// ─────────────────────────────────────────────────────
// 3. CONTACT FORM
// ─────────────────────────────────────────────────────
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm));
    if (!data.name || !data.email || !data.message) {
      alert('Please fill in Name, Email and Message.'); return;
    }

    const btn = contactForm.querySelector('button[type="submit"]');
    const origLabel = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      const res  = await fetch(`${BACKEND_URL}/api/contact`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const raw  = await res.text();
      let json   = null;
      try { json = raw ? JSON.parse(raw) : null; } catch {}

      const ok = res.ok && (json?.success ?? true);
      if (ok) {
        contactForm.reset();
        showContactMessage(json?.message || 'Message sent successfully!', false);
      } else {
        showContactMessage(json?.message || 'Failed to send. Please try again.', true);
      }
    } catch (err) {
      console.error('Contact form error:', err);
      showContactMessage('Could not reach the server. Please try again later.', true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origLabel; }
    }
  });
}

function showContactMessage(msg, isError) {
  const successEl = document.getElementById('formSuccess');
  let el = successEl || document.getElementById('contactFormStatus');
  if (!el || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
    el = document.createElement('div');
    el.id = 'contactFormStatus';
    el.setAttribute('role', 'alert');
    contactForm?.after(el);
  }
  el.textContent = msg;
  el.hidden = false;
  el.style.color = isError ? '#ef4444' : '#22c55e';
  el.style.marginTop = '.75rem';
  setTimeout(() => { el.textContent = ''; if (el === successEl) el.hidden = true; }, 6000);
}

// ─────────────────────────────────────────────────────
// 4. LIVE CHAT WIDGET (inline — uses same BACKEND_URL)
// ─────────────────────────────────────────────────────
(function initChatWidget() {
  let sessionId = sessionStorage.getItem('cac_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
    sessionStorage.setItem('cac_session_id', sessionId);
  }
  const visitorName = 'Visitor';

  const widget = document.createElement('div');
  widget.id = 'cacChatWidget';
  widget.innerHTML = `
    <style>
      #cacChatWidget * { box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
      #chatToggleBtn {
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: #4f6ef7; color: #fff; border: none; border-radius: 50%;
        width: 56px; height: 56px; font-size: 1.5rem;
        cursor: pointer; box-shadow: 0 4px 16px rgba(79,110,247,.5);
        transition: transform .2s;
      }
      #chatToggleBtn:hover { transform: scale(1.1); }
      #chatBubbleCount {
        position: absolute; top: -4px; right: -4px;
        background: #ef4444; color: #fff; border-radius: 50%;
        width: 20px; height: 20px; font-size: .7rem;
        display: none; align-items: center; justify-content: center; font-weight: 700;
      }
      #chatBox {
        position: fixed; bottom: 90px; right: 24px; z-index: 9998;
        width: 330px; background: #1a1d27; border: 1px solid #2e3248;
        border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.5);
        display: none; flex-direction: column; overflow: hidden;
      }
      #chatBox.open { display: flex; }
      #chatBoxHeader {
        background: #4f6ef7; color: #fff; padding: .75rem 1rem;
        font-weight: 700; display: flex; justify-content: space-between; align-items: center;
      }
      #chatBoxHeader button { background: none; border: none; color: #fff; font-size: 1.1rem; cursor: pointer; }
      #chatBoxMessages {
        flex: 1; min-height: 240px; max-height: 320px; overflow-y: auto;
        padding: .75rem; display: flex; flex-direction: column; gap: .5rem;
      }
      .cw-bubble { max-width: 80%; padding: .5rem .8rem; border-radius: 10px; font-size: .83rem; }
      .cw-bubble.visitor { background: #22263a; align-self: flex-end; }
      .cw-bubble.admin   { background: #4f6ef7; color: #fff; align-self: flex-start; }
      #chatBoxInput { display: flex; gap: .4rem; padding: .6rem; border-top: 1px solid #2e3248; }
      #chatBoxInput input {
        flex: 1; background: #22263a; border: 1px solid #2e3248; border-radius: 7px;
        color: #e2e8f0; padding: .4rem .7rem; font-size: .83rem;
      }
      #chatBoxInput button {
        background: #4f6ef7; color: #fff; border: none; border-radius: 7px;
        padding: .4rem .9rem; cursor: pointer; font-size: .83rem;
      }
    </style>

    <button id="chatToggleBtn" title="Chat with us">
      💬
      <span id="chatBubbleCount"></span>
    </button>

    <div id="chatBox">
      <div id="chatBoxHeader">
        <span>💬 Live Chat</span>
        <button id="chatCloseBtn">✕</button>
      </div>
      <div id="chatBoxMessages">
        <div class="cw-bubble admin">Hi! How can we help you today?</div>
      </div>
      <div id="chatBoxInput">
        <input id="chatWidgetInput" type="text" placeholder="Type a message…" />
        <button id="chatWidgetSend">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  let unread = 0;
  document.getElementById('chatToggleBtn').addEventListener('click', () => {
    document.getElementById('chatBox').classList.toggle('open');
    unread = 0;
    const badge = document.getElementById('chatBubbleCount');
    badge.style.display = 'none'; badge.textContent = '';
  });
  document.getElementById('chatCloseBtn').addEventListener('click', () => {
    document.getElementById('chatBox').classList.remove('open');
  });

  // ✅ FIX 3: Load socket.io from backend URL (works in production)
  const script = document.createElement('script');
  script.src   = `${BACKEND_URL}/socket.io/socket.io.js`;
  script.onload = () => {
    // ✅ FIX 4: pass withCredentials + both transports for production Socket.IO
    const socket = window.io(BACKEND_URL, {
      transports:      ['websocket', 'polling'],
      withCredentials: false,  // public chat — no auth cookie needed
    });
    socket.on('connect', () => socket.emit('join-session', { sessionId, visitorName }));
    socket.on('new-message', (msg) => {
      if (msg.from !== 'admin') return;
      appendWidgetBubble(msg.message, 'admin');
      if (!document.getElementById('chatBox').classList.contains('open')) {
        unread++;
        const badge = document.getElementById('chatBubbleCount');
        badge.textContent = unread; badge.style.display = 'flex';
      }
    });
    socket.on('chat-history', (history) => {
      const panel = document.getElementById('chatBoxMessages');
      panel.innerHTML = '';
      history.forEach(m => appendWidgetBubble(m.message, m.from));
    });
    document.getElementById('chatWidgetSend').addEventListener('click',  () => sendWidget(socket, sessionId));
    document.getElementById('chatWidgetInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendWidget(socket, sessionId);
    });
  };
  script.onerror = () => console.error('[CAC Chat] Could not load socket.io from', script.src);
  document.head.appendChild(script);

  function sendWidget(socket, sessionId) {
    const input   = document.getElementById('chatWidgetInput');
    const message = input.value.trim();
    if (!message) return;
    socket.emit('visitor-message', { sessionId, message });
    appendWidgetBubble(message, 'visitor');
    input.value = '';
  }

  function appendWidgetBubble(message, from) {
    const panel = document.getElementById('chatBoxMessages');
    const div   = document.createElement('div');
    div.className   = `cw-bubble ${from}`;
    div.textContent = message;
    panel.appendChild(div);
    panel.scrollTop = panel.scrollHeight;
  }
})();

// ─────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }

// ─────────────────────────────────────────────────────
// Hero counters
// ─────────────────────────────────────────────────────
(function initHeroCounters() {
  const stats = document.querySelector('.hero__stats');
  if (!stats) return;
  const els = Array.from(stats.querySelectorAll('[data-count]'));
  if (!els.length) return;
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const animateOne = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';
    const target   = Number(el.dataset.count || 0);
    const suffix   = el.dataset.suffix || '';
    const duration = Math.min(1800, Math.max(900, Math.round(900 + (target > 1000 ? 700 : target * 10))));
    const start = performance.now();
    const tick  = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = Math.round(target * easeOutCubic(t));
      el.textContent = nf.format(v) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const runAll = () => els.forEach(animateOne);
  if (!('IntersectionObserver' in window)) { runAll(); return; }
  const obs = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { runAll(); obs.disconnect(); }
  }, { threshold: 0.25 });
  obs.observe(stats);
})();
