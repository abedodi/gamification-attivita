// ========================================
// TEMA
// ========================================

export function applyTheme(project) {
  if (!project?.theme) return;
  const root = document.documentElement;
  const { primaryColor, accentColor, fontStyle } = project.theme;
  if (primaryColor) {
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-dark', darkenHex(primaryColor, 20));
    root.style.setProperty('--color-primary-light', lightenHex(primaryColor, 90));
  }
  if (accentColor) root.style.setProperty('--color-accent', accentColor);
  document.body.dataset.font = fontStyle || 'rounded';
}

export function resetTheme() {
  const root = document.documentElement;
  ['--color-primary','--color-primary-dark','--color-primary-light','--color-accent']
    .forEach(v => root.style.removeProperty(v));
  delete document.body.dataset.font;
}

function darkenHex(hex, amount) {
  return shiftHex(hex, -amount);
}
function lightenHex(hex, pct) {
  // mix with white
  const num = parseInt(hex.replace('#',''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8)  & 0xff;
  const b =  num        & 0xff;
  const mix = v => Math.round(v + (255 - v) * (pct / 100));
  return '#' + [mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2,'0')).join('');
}
function shiftHex(hex, delta) {
  const num = parseInt(hex.replace('#',''), 16);
  const clamp = v => Math.max(0, Math.min(255, v + delta));
  const r = clamp((num >> 16) & 0xff);
  const g = clamp((num >> 8)  & 0xff);
  const b = clamp( num        & 0xff);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// ========================================
// TASK RICORRENTI
// ========================================

export function getPeriodStart(recurrence, now = new Date()) {
  const d = new Date(now);
  if (recurrence === 'daily') {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (recurrence === 'weekly') {
    const day = d.getDay(); // 0 = domenica
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (recurrence === 'monthly') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return d;
}

export function getRecurringTaskState(activity, now = new Date()) {
  if (activity.type !== 'recurring') return null;
  const periodStart = getPeriodStart(activity.recurrence, now);
  const lastCompleted = toDate(activity.lastCompleted);
  if (!lastCompleted || lastCompleted < periodStart) return 'open';
  return 'completed_this_cycle';
}

export function getNextReset(recurrence, now = new Date()) {
  const d = new Date(now);
  if (recurrence === 'daily') {
    return 'domani';
  }
  if (recurrence === 'weekly') {
    const day = d.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    return `lunedì ${d.getDate()}/${d.getMonth() + 1}`;
  }
  if (recurrence === 'monthly') {
    const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const m = (d.getMonth() + 1) % 12 + 1;
    return `1/${m}`;
  }
  return '';
}

// ========================================
// TASK SCADENZA
// ========================================

export function getDeadlineState(activity, now = new Date()) {
  if (activity.type !== 'deadline') return null;
  if (activity.status === 'done') return 'done';
  const deadline = toDate(activity.deadline);
  if (!deadline) return 'open';
  const ms = deadline.getTime() - now.getTime();
  if (ms > 24 * 3600 * 1000) return 'open';
  if (ms > 0)                 return 'due_soon';
  return 'overdue';
}

// ========================================
// DATE & FORMAT
// ========================================

export function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  return new Date(value);
}

export function formatDate(ts) {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(ts) {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(ts) {
  const d = toDate(ts);
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1)   return 'adesso';
  if (mins < 60)  return `${mins} min fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'ieri' : `${days} giorni fa`;
}

// ========================================
// URL & CONDIVISIONE
// ========================================

export function getPlayUrl(projectId) {
  const base = window.location.href.split('#')[0];
  return `${base}#/play/${projectId}`;
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// ========================================
// MODAL
// ========================================

let _escOnClose = null;
function _escHandler(e) { if (e.key === 'Escape') closeModal(); }

export function openModal(html, { onClose } = {}) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  _escOnClose = onClose ?? null;
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
  document.addEventListener('keydown', _escHandler);
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
  document.removeEventListener('keydown', _escHandler);
  const cb = _escOnClose;
  _escOnClose = null;
  cb?.();
}

// ========================================
// TOAST
// ========================================

export function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-visible')));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

// ========================================
// HELPERS GENERICI
// ========================================

export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
