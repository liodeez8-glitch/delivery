// admin/public/js/admin.js
'use strict';

// ── Config ────────────────────────────────────────────
// Change to your deployed URL for production
const BACKEND_URL = (typeof window !== 'undefined' && window.CAC_BACKEND_URL)
  ? window.CAC_BACKEND_URL.replace(/\/$/, '')
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

// ─────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────
const getToken  = () => localStorage.getItem('cac_admin_token');
const setToken  = t  => localStorage.setItem('cac_admin_token', t);
const clearAuth = () => { localStorage.removeItem('cac_admin_token'); localStorage.removeItem('cac_admin_email'); };
const getEmail  = () => localStorage.getItem('cac_admin_email') || '';
const setEmail  = e  => localStorage.setItem('cac_admin_email', e);

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: authHeaders(),
    ...opts,
  });
  if (res.status === 401) { clearAuth(); window.location.href = 'index.html'; return null; }
  return res;
}

// ─────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
function showMsg(id, msg, isError = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
  el.className = isError ? 'error-msg' : 'success-msg';
}

// ─────────────────────────────────────────────────────
// ── LOGIN PAGE ────────────────────────────────────────
// ─────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg('loginError', '');

    const email    = document.getElementById('email')?.value.trim()    || '';
    const password = document.getElementById('password')?.value.trim() || '';

    if (!email || !password) {
      showMsg('loginError', 'Please enter both email and password.'); return;
    }

    const btn = document.getElementById('loginBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try { data = await res.json(); }
      catch { throw new Error('Server returned an invalid response. Is the backend running?'); }

      if (res.ok && data.success) {
        setToken(data.token);
        setEmail(data.admin?.email || email);
        window.location.href = 'dashboard.html';
      } else {
        showMsg('loginError', data.message || 'Invalid email or password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      showMsg('loginError',
        err.message.includes('Failed to fetch')
          ? '⚠️ Cannot reach the server. Make sure the backend is running on port 3000.'
          : err.message
      );
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    }
  });
}

// ─────────────────────────────────────────────────────
// ── DASHBOARD PAGE ────────────────────────────────────
// ─────────────────────────────────────────────────────
if (document.getElementById('dashboardRoot')) {
  // Guard: redirect if not logged in
  if (!getToken()) { window.location.href = 'index.html'; }
  else { initDashboard(); }
}

// ── Logout ────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  clearAuth();
  window.location.href = 'index.html';
});

// ── Section navigation ────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(link.dataset.section);
  });
});

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-section="${name}"]`)?.classList.add('active');
}

// ─────────────────────────────────────────────────────
// Dashboard init
// ─────────────────────────────────────────────────────
async function initDashboard() {
  setText('adminEmail', getEmail());
  await loadStats();
  await loadShipments();
  await loadContacts();
  initChat();
}

// ─────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await apiFetch('/api/admin/stats');
    if (!res) return;
    const data = await res.json();
    if (!data.success) return;
    const s = data.stats;
    setText('statsTotal',     s.total);
    setText('statsInTransit', s.inTransit);
    setText('statsDelivered', s.delivered);
    setText('statsProcessing', s.processing);
    setText('statsMessages',  s.unreadMessages);
    // Update nav badge
    const navBadge = document.getElementById('navMsgBadge');
    if (navBadge) {
      if (s.unreadMessages > 0) { navBadge.textContent = s.unreadMessages; navBadge.style.display = 'inline-flex'; }
      else navBadge.style.display = 'none';
    }
  } catch (err) { console.error('loadStats:', err); }
}

// ─────────────────────────────────────────────────────
// Shipments
// ─────────────────────────────────────────────────────
let currentPage = 1;

async function loadShipments(page = 1) {
  currentPage = page;
  const search = document.getElementById('searchInput')?.value.trim()   || '';
  const status = document.getElementById('statusFilter')?.value          || '';
  const mode   = document.getElementById('modeFilter')?.value            || '';
  const params = new URLSearchParams({ page, limit: 20 });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (mode)   params.set('mode', mode);

  try {
    const res  = await apiFetch(`/api/admin/shipments?${params}`);
    if (!res) return;
    const data = await res.json();
    if (!data.success) return;
    renderShipments(data.shipments);
    renderPagination(data.page, data.pages);
  } catch (err) { console.error('loadShipments:', err); }
}

function applyFilters() { loadShipments(1); }

// ── Premium mode icons (Heroicons solid, 3D gradient containers) ──────
const MODE_ICONS = {
  air: `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(145deg,#E8352E 0%,#A51410 100%);box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 3px 8px rgba(208,32,26,.45);position:relative;overflow:hidden;flex-shrink:0;"><span style="position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,.15) 0%,transparent 100%);border-radius:8px 8px 0 0;"></span><svg width="14" height="14" viewBox="0 0 24 24" fill="white" style="position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg></span>`,
  sea: `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(145deg,#22D3EE 0%,#0891B2 60%,#055160 100%);box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 3px 8px rgba(34,211,238,.4);position:relative;overflow:hidden;flex-shrink:0;"><span style="position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,.15) 0%,transparent 100%);border-radius:8px 8px 0 0;"></span><svg width="14" height="14" viewBox="0 0 24 24" fill="white" style="position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))"><path fill-rule="evenodd" d="M9 3.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-1.5v2.128l5.28 2.11a.75.75 0 01.47.697v4.315a.75.75 0 01-.5.712l-8.25 2.75a.75.75 0 01-.5 0l-8.25-2.75A.75.75 0 011.5 14.5v-4.315a.75.75 0 01.47-.697l5.28-2.11V4.5H5.75a.75.75 0 010-1.5H9zm1.5 1.5v2.25a.75.75 0 01-.5.707L4.42 10.115l7.08 2.36 7.08-2.36-5.58-2.228a.75.75 0 01-.5-.707V5.25h-2z" clip-rule="evenodd"/></svg></span>`,
  land:`<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(145deg,#F5B731 0%,#C8860A 60%,#8F5E05 100%);box-shadow:0 1px 0 rgba(255,255,255,.15) inset,0 3px 8px rgba(232,160,32,.45);position:relative;overflow:hidden;flex-shrink:0;"><span style="position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,.18) 0%,transparent 100%);border-radius:8px 8px 0 0;"></span><svg width="14" height="14" viewBox="0 0 24 24" fill="white" style="position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))"><path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 13.5h.187a3 3 0 011.5 5.57v.93a.75.75 0 01-.75.75h-13.5a.75.75 0 01-.75-.75v-.93a3 3 0 011.5-5.57H13.5z"/><path d="M13.5 4.5v9H21v-4.5a.75.75 0 00-.22-.53l-3-3a.75.75 0 00-.53-.22H13.5zM15.75 16.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg></span>`,
};
const MODE_LABELS = { air: 'Air', sea: 'Sea', land: 'Land' };

// Heroicon pencil-square
const ICON_EDIT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z"/></svg>`;
// Heroicon trash
const ICON_DEL  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clip-rule="evenodd"/></svg>`;

function renderShipments(list) {
  const tbody = document.getElementById('shipmentsTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No shipments found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(s => {
    const modeIcon = MODE_ICONS[s.transportMode] || '';
    const modeLabel = MODE_LABELS[s.transportMode] || (s.transportMode || '—');
    return `
    <tr>
      <td><code>${esc(s.trackingCode || '—')}</code></td>
      <td>${esc(s.recipientName)}</td>
      <td style="color:var(--muted);font-size:13px">${esc(s.packageContent || '—')}</td>
      <td><span style="display:inline-flex;align-items:center;gap:7px;">${modeIcon}<span style="font-size:12.5px;font-weight:600;color:rgba(255,255,255,.75)">${modeLabel}</span></span></td>
      <td><span class="badge status-${esc(s.shippingStatus)}">${fmtStatus(s.shippingStatus)}</span></td>
      <td style="font-size:13px;color:var(--muted)">${s.arrivalDate ? fmtDate(s.arrivalDate) : '—'}</td>
      <td><span style="display:flex;gap:6px;">
        <button class="btn btn-secondary btn-xs" onclick="openEditShipment('${esc(s._id)}')" title="Edit shipment" style="gap:5px">${ICON_EDIT} Edit</button>
        <button class="btn btn-danger btn-xs"    onclick="deleteShipment('${esc(s._id)}', '${esc(s.trackingCode)}')" title="Delete shipment" style="gap:5px">${ICON_DEL} Del</button>
      </span></td>
    </tr>`;
  }).join('');
}

function renderPagination(current, total) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn${i === current ? ' active' : ''}" onclick="loadShipments(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

// ── New / Edit Shipment form ──────────────────────────
const shipmentForm = document.getElementById('shipmentForm');
if (shipmentForm) {
  shipmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg('shipmentFormError', '');
    showMsg('shipmentFormSuccess', '');

    const id   = document.getElementById('shipmentId').value.trim();
    const body = {
      trackingCode:     document.getElementById('fTrackingCode').value.trim()     || undefined,
      transportMode:    document.getElementById('fTransportMode').value,
      shippingStatus:   document.getElementById('fStatus').value,
      senderName:       document.getElementById('fSenderName').value.trim(),
      senderPhone:      document.getElementById('fSenderPhone').value.trim(),
      senderAddress:    document.getElementById('fSenderAddress').value.trim(),
      senderEmail:      document.getElementById('fSenderEmail').value.trim(),
      recipientName:    document.getElementById('fRecipientName').value.trim(),
      recipientPhone:   document.getElementById('fRecipientPhone').value.trim(),
      recipientAddress: document.getElementById('fRecipientAddress').value.trim(),
      recipientEmail:   document.getElementById('fRecipientEmail').value.trim(),
      packageContent:   document.getElementById('fPackageContent').value.trim(),
      packageWeight:    parseFloat(document.getElementById('fWeight').value) || 0,
      packageQuantity:  parseInt(document.getElementById('fQuantity').value) || 1,
      packageDimensions:document.getElementById('fDimensions').value.trim(),
      origin:           document.getElementById('fOrigin').value.trim(),
      destination:      document.getElementById('fDestination').value.trim(),
      currentLocation:  document.getElementById('fCurrentLocation').value.trim(),
      shipmentDate:     document.getElementById('fShipmentDate').value || undefined,
      arrivalDate:      document.getElementById('fArrivalDate').value  || undefined,
      shippingFee:      parseFloat(document.getElementById('fFee').value) || 0,
      currency:         document.getElementById('fCurrency').value,
      adminNotes:       document.getElementById('fNotes').value.trim(),
    };

    if (!body.recipientName || !body.recipientAddress) {
      showMsg('shipmentFormError', 'Recipient name and address are required.'); return;
    }

    const btn = document.getElementById('shipmentSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const method = id ? 'PUT' : 'POST';
      const url    = id ? `/api/admin/shipments/${id}` : '/api/admin/shipments';
      const res    = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!res) return;
      const data   = await res.json();
      if (data.success) {
        showMsg('shipmentFormSuccess', `Shipment ${id ? 'updated' : 'created'} successfully! Code: ${data.shipment.trackingCode}`, false);
        if (!id) resetShipmentForm();
        await loadShipments(currentPage);
        await loadStats();
      } else {
        showMsg('shipmentFormError', data.message || 'Save failed.');
      }
    } catch (err) {
      showMsg('shipmentFormError', err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Shipment'; }
    }
  });
}

function resetShipmentForm() {
  document.getElementById('shipmentForm')?.reset();
  document.getElementById('shipmentId').value = '';
  setText('shipmentFormTitle', 'New Shipment');
  showMsg('shipmentFormError', '');
  showMsg('shipmentFormSuccess', '');
  showSection('new-shipment');
}

async function openEditShipment(id) {
  try {
    const res  = await apiFetch(`/api/admin/shipments/${id}`);
    if (!res) return;
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    const s = data.shipment;

    // Populate form
    document.getElementById('shipmentId').value         = s._id;
    document.getElementById('fTrackingCode').value      = s.trackingCode      || '';
    document.getElementById('fTransportMode').value     = s.transportMode     || 'air';
    document.getElementById('fStatus').value            = s.shippingStatus    || 'processing';
    document.getElementById('fSenderName').value        = s.senderName        || '';
    document.getElementById('fSenderPhone').value       = s.senderPhone       || '';
    document.getElementById('fSenderAddress').value     = s.senderAddress     || '';
    document.getElementById('fSenderEmail').value       = s.senderEmail       || '';
    document.getElementById('fRecipientName').value     = s.recipientName     || '';
    document.getElementById('fRecipientPhone').value    = s.recipientPhone    || '';
    document.getElementById('fRecipientAddress').value  = s.recipientAddress  || '';
    document.getElementById('fRecipientEmail').value    = s.recipientEmail    || '';
    document.getElementById('fPackageContent').value    = s.packageContent    || '';
    document.getElementById('fWeight').value            = s.packageWeight     || '';
    document.getElementById('fQuantity').value          = s.packageQuantity   || 1;
    document.getElementById('fDimensions').value        = s.packageDimensions || '';
    document.getElementById('fOrigin').value            = s.origin            || '';
    document.getElementById('fDestination').value       = s.destination       || '';
    document.getElementById('fCurrentLocation').value   = s.currentLocation   || '';
    document.getElementById('fShipmentDate').value      = fmtDateInput(s.shipmentDate);
    document.getElementById('fArrivalDate').value       = fmtDateInput(s.arrivalDate);
    document.getElementById('fFee').value               = s.shippingFee       || '';
    document.getElementById('fCurrency').value          = s.currency          || 'USD';
    document.getElementById('fNotes').value             = s.adminNotes        || '';
    setText('shipmentFormTitle', `Edit Shipment — ${s.trackingCode}`);
    showSection('new-shipment');
  } catch (err) { alert('Failed to load shipment: ' + err.message); }
}

async function deleteShipment(id, code) {
  if (!confirm(`Delete shipment ${code}? This cannot be undone.`)) return;
  try {
    const res  = await apiFetch(`/api/admin/shipments/${id}`, { method: 'DELETE' });
    if (!res) return;
    const data = await res.json();
    if (data.success) { await loadShipments(currentPage); await loadStats(); }
    else alert(data.message);
  } catch (err) { alert(err.message); }
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

// ─────────────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────────────
async function loadContacts() {
  try {
    const res  = await apiFetch('/api/admin/contacts');
    if (!res) return;
    const data = await res.json();
    if (!data.success) return;
    renderContacts(data.contacts);
  } catch (err) { console.error('loadContacts:', err); }
}

function renderContacts(list) {
  const tbody = document.getElementById('contactsTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No messages yet.</td></tr>';
    return;
  }
  const CHECK_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/></svg>`;
  const REPLY_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10.5 7.5V4.21a.75.75 0 011.28-.53l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.28-.53V15c-4.2 0-7.2 1.2-9 3.6.3-5.1 3-10.2 9-11.1z"/></svg>`;
  tbody.innerHTML = list.map(c => `
    <tr class="${c.read ? '' : 'unread'}">
      <td style="font-weight:${c.read ? '400' : '600'}">${esc(c.name)}</td>
      <td style="font-size:13px;color:var(--muted)">${esc(c.email)}</td>
      <td style="font-size:13px">${esc(c.subject || '—')}</td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--muted)" title="${esc(c.message)}">${esc(c.message)}</td>
      <td style="font-size:12px;color:var(--muted)">${fmtDate(c.createdAt)}</td>
      <td>
        <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-outline btn-xs" onclick="replyContact('${esc(c._id)}')" style="gap:5px">${REPLY_ICON} Reply</button>
          ${!c.read
            ? `<button class="btn btn-secondary btn-xs" onclick="markRead('${esc(c._id)}')" style="gap:5px">${CHECK_ICON} Mark Read</button>`
            : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--green);font-family:var(--font-display);letter-spacing:.06em;text-transform:uppercase">${CHECK_ICON} Read</span>`}
        </span>
      </td>
    </tr>
  `).join('');
}

async function markRead(id) {
  try {
    const res = await apiFetch(`/api/admin/contacts/${id}/read`, { method: 'PUT' });
    if (!res) return;
    await loadContacts();
    await loadStats();
  } catch (err) { console.error('markRead:', err); }
}

async function replyContact(id) {
  const subject = prompt('Reply subject (optional):') || '';
  const message = prompt('Type your reply message:') || '';
  if (!message.trim()) return;

  try {
    const res = await apiFetch(`/api/admin/contacts/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ subject, message }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to send reply.');
      return;
    }
    alert('Reply sent.');
  } catch (err) {
    console.error('replyContact:', err);
    alert(err.message || 'Failed to send reply.');
  }
}

// ─────────────────────────────────────────────────────
// Live Chat (Socket.io admin side)
// ─────────────────────────────────────────────────────
let socket          = null;
let activeSessionId = null;
const sessions      = {};   // sessionId → { visitorName, messages[] }
const KNOWN_SESSIONS_KEY = 'cac_known_chat_sessions';
const LAST_SESSION_KEY   = 'cac_last_chat_session';

function initChat() {
  hydrateKnownSessions();
  renderSessionList();

  // Dynamically load socket.io client from backend
  const script  = document.createElement('script');
  script.src    = `${BACKEND_URL}/socket.io/socket.io.js`;
  script.onload = connectSocket;
  script.onerror = () => console.warn('⚠️ Socket.io client script failed to load');
  document.head.appendChild(script);
}

function connectSocket() {
  socket = window.io(BACKEND_URL, {
    auth: { role: 'admin' },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('💬 Admin socket connected');
    socket.emit('join-admin');
  });

  socket.on('active-sessions', (arr) => {
    (arr || []).forEach(s => {
      if (!s?.sessionId) return;
      if (!sessions[s.sessionId]) sessions[s.sessionId] = { visitorName: s.visitorName || 'Visitor', messages: [] };
      sessions[s.sessionId].visitorName = s.visitorName || sessions[s.sessionId].visitorName || 'Visitor';
      sessions[s.sessionId].online = true;
      rememberSession(s.sessionId, sessions[s.sessionId].visitorName);
    });
    renderSessionList();
    autoSelectLastSession();
  });

  socket.on('visitor-joined', ({ sessionId, visitorName }) => {
    if (!sessionId) return;
    if (!sessions[sessionId]) sessions[sessionId] = { visitorName, messages: [] };
    sessions[sessionId].visitorName = visitorName || sessions[sessionId].visitorName || 'Visitor';
    sessions[sessionId].online = true;
    rememberSession(sessionId, sessions[sessionId].visitorName);
    renderSessionList();
  });

  socket.on('visitor-left', ({ sessionId }) => {
    if (!sessionId) return;
    if (sessions[sessionId]) sessions[sessionId].online = false;
    renderSessionList();
  });

  socket.on('new-message', (msg) => {
    if (!msg?.sessionId) return;
    if (!sessions[msg.sessionId]) sessions[msg.sessionId] = { visitorName: msg.visitorName || 'Visitor', messages: [] };
    sessions[msg.sessionId].visitorName = msg.visitorName || sessions[msg.sessionId].visitorName || 'Visitor';
    sessions[msg.sessionId].messages.push(msg);
    sessions[msg.sessionId].lastTs = msg.createdAt || msg.ts || new Date().toISOString();
    rememberSession(msg.sessionId, sessions[msg.sessionId].visitorName);
    if (msg.sessionId === activeSessionId) appendChatBubble(msg);
    renderSessionList();
  });

  socket.on('chat-history', (history) => {
    if (!activeSessionId) return;
    const panel = document.getElementById('chatMessages');
    if (!panel) return;
    panel.innerHTML = '';
    if (!sessions[activeSessionId]) sessions[activeSessionId] = { visitorName: 'Visitor', messages: [] };
    sessions[activeSessionId].messages = Array.isArray(history) ? history : [];
    const last = sessions[activeSessionId].messages[sessions[activeSessionId].messages.length - 1];
    sessions[activeSessionId].lastTs = last?.createdAt || last?.ts || sessions[activeSessionId].lastTs;
    sessions[activeSessionId].messages.forEach(m => appendChatBubble(m));
    rememberSession(activeSessionId, sessions[activeSessionId].visitorName);
  });

  socket.on('disconnect', () => console.log('💬 Admin socket disconnected'));
}

function renderSessionList() {
  const list = document.getElementById('sessionList');
  if (!list) return;
  const ids = Object.keys(sessions).sort((a, b) => {
    const ta = sessions[a]?.lastTs ? Date.parse(sessions[a].lastTs) : 0;
    const tb = sessions[b]?.lastTs ? Date.parse(sessions[b].lastTs) : 0;
    return tb - ta;
  });
  if (!ids.length) {
    list.innerHTML = '<li class="empty-row">No active visitors</li>';
    return;
  }
  list.innerHTML = ids.map(sid => `
    <li class="session-item${sid === activeSessionId ? ' active' : ''}"
        onclick="selectSession('${sid}')">
      <div class="session-name">
        ${sessions[sid].online ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:8px;vertical-align:middle"></span>' : ''}
        ${esc(sessions[sid].visitorName || 'Visitor')}
      </div>
      <div class="session-meta">${sid.substring(0, 12)}…</div>
    </li>
  `).join('');
}

function selectSession(sessionId) {
  activeSessionId = sessionId;
  try { localStorage.setItem(LAST_SESSION_KEY, sessionId); } catch {}
  renderSessionList();
  const panel = document.getElementById('chatMessages');
  if (panel) panel.innerHTML = '<p class="empty-row">Loading history…</p>';

  const input = document.getElementById('chatInput');
  const btn   = document.getElementById('chatSendBtn');
  if (input) input.disabled = false;
  if (btn)   btn.disabled   = false;

  // Load history from server
  if (socket) socket.emit('get-history', { sessionId });
}

function appendChatBubble(msg) {
  const panel = document.getElementById('chatMessages');
  if (!panel) return;
  // Clear placeholder text
  if (panel.children.length === 1 && panel.children[0].tagName === 'P') panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = `chat-bubble-wrap from-${msg.from}`;
  wrap.innerHTML = `
    <div class="chat-bubble from-${msg.from}">${esc(msg.message)}</div>
    <div class="chat-meta">${msg.from === 'admin' ? 'You (Admin)' : esc(msg.visitorName || 'Visitor')} · ${fmtTime(msg.createdAt || msg.ts)}</div>
  `;
  panel.appendChild(wrap);
  panel.scrollTop = panel.scrollHeight;
}

document.getElementById('chatSendBtn')?.addEventListener('click', sendAdminMessage);
document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendAdminMessage();
});

function sendAdminMessage() {
  const input = document.getElementById('chatInput');
  if (!input || !socket || !activeSessionId) return;
  const message = input.value.trim();
  if (!message) return;

  const optimistic = {
    sessionId: activeSessionId,
    visitorName: sessions[activeSessionId]?.visitorName || 'Visitor',
    from: 'admin',
    message,
    createdAt: new Date().toISOString(),
  };
  if (!sessions[activeSessionId]) sessions[activeSessionId] = { visitorName: optimistic.visitorName, messages: [] };
  sessions[activeSessionId].messages.push(optimistic);
  sessions[activeSessionId].lastTs = optimistic.createdAt;
  appendChatBubble(optimistic);
  renderSessionList();

  socket.emit('admin-message', { sessionId: activeSessionId, message });
  input.value = '';
}

function hydrateKnownSessions() {
  let known = [];
  try { known = JSON.parse(localStorage.getItem(KNOWN_SESSIONS_KEY) || '[]'); } catch {}
  (known || []).forEach(s => {
    if (!s?.sessionId) return;
    if (!sessions[s.sessionId]) sessions[s.sessionId] = { visitorName: s.visitorName || 'Visitor', messages: [] };
    sessions[s.sessionId].visitorName = s.visitorName || sessions[s.sessionId].visitorName || 'Visitor';
    sessions[s.sessionId].lastTs = s.lastTs || sessions[s.sessionId].lastTs;
    sessions[s.sessionId].online = false;
  });
}

function rememberSession(sessionId, visitorName) {
  let known = [];
  try { known = JSON.parse(localStorage.getItem(KNOWN_SESSIONS_KEY) || '[]'); } catch {}
  const now = new Date().toISOString();
  const idx = (known || []).findIndex(s => s.sessionId === sessionId);
  const entry = { sessionId, visitorName: visitorName || 'Visitor', lastTs: now };
  if (idx >= 0) known[idx] = { ...known[idx], ...entry };
  else known.push(entry);
  try { localStorage.setItem(KNOWN_SESSIONS_KEY, JSON.stringify(known.slice(-50))); } catch {}
}

function autoSelectLastSession() {
  if (activeSessionId) return;
  let last = '';
  try { last = localStorage.getItem(LAST_SESSION_KEY) || ''; } catch {}
  if (last && sessions[last]) {
    selectSession(last);
    return;
  }
  const first = Object.keys(sessions)[0];
  if (first) selectSession(first);
}

// ─────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d)      { return d ? new Date(d).toLocaleDateString('en-GB') : '—'; }
function fmtDateInput(d) { return d ? new Date(d).toISOString().split('T')[0] : ''; }
function fmtTime(d)      { return d ? new Date(d).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : ''; }
function fmtStatus(s)    { return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
