import { subscribeLog, deleteLogEntry }     from '../firebase.js';
import { formatRelative, escapeHtml,
         openModal, closeModal, showToast }  from '../utils.js';

let _unsub      = null;
let _pageSize   = 20;
let _container  = null;
let _projectId  = null;
let _isAdmin    = false;
let _entries    = [];

export function mountLogHistory(container, projectId, isAdmin = false) {
  _container = container;
  _projectId = projectId;
  _isAdmin   = isAdmin;
  _pageSize  = 20;
  subscribe();
}

export function unmountLogHistory() {
  if (_unsub) { _unsub(); _unsub = null; }
}

// ── Subscription ──────────────────────────────────────────

function subscribe() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = subscribeLog(_projectId, entries => {
    _entries = entries;
    render(entries);
  }, _pageSize);
}

// ── Render ────────────────────────────────────────────────

function render(entries) {
  if (!_container) return;

  if (entries.length === 0) {
    _container.innerHTML = `
      <div class="log-empty">
        <span>📋</span>
        <p>Nessuna attività ancora.<br>Inizia a registrare!</p>
      </div>`;
    return;
  }

  _container.innerHTML = `
    <div class="log-list" id="log-list-inner">
      ${entries.map(e => entryHTML(e)).join('')}
    </div>
    ${entries.length === _pageSize
      ? `<div class="log-load-more">
           <button class="btn btn-ghost btn-sm" id="btn-load-more">Carica altri…</button>
         </div>`
      : `<p class="log-end-label">Hai visto tutto (${entries.length} voci)</p>`}`;

  document.getElementById('btn-load-more')?.addEventListener('click', () => {
    _pageSize += 20;
    subscribe();
  });

  // Event delegation per il bottone elimina
  document.getElementById('log-list-inner')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete-log');
    if (!btn) return;
    const entryId = btn.dataset.id;
    const entry   = _entries.find(e => e.id === entryId);
    if (entry) confirmDelete(entry);
  });
}

// ── Entry HTML ────────────────────────────────────────────

function entryHTML(e) {
  const isPenalty = e.type === 'penalty';
  const pts       = e.finalPoints >= 0 ? `+${e.finalPoints}` : `${e.finalPoints}`;
  const ptsColor  = e.finalPoints >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  const timeAgo   = formatRelative(e.timestamp);

  const badges = [
    isPenalty        ? '<span class="le-badge le-badge-penalty">⚠️ Penalità</span>' : '',
    e.multiplier > 1 ? `<span class="le-badge le-badge-event">×${e.multiplier}</span>` : '',
  ].filter(Boolean).join('');

  const deleteBtn = _isAdmin
    ? `<button class="btn-delete-log" data-id="${e.id}" title="Elimina voce e storna punti">🗑</button>`
    : '';

  return `
    <div class="log-entry ${isPenalty ? 'log-entry-penalty' : ''}">
      <span class="le-emoji">${escapeHtml(e.activityEmoji ?? '⭐')}</span>
      <div class="le-info">
        <span class="le-name">${escapeHtml(e.activityName)}</span>
        <span class="le-meta">
          ${escapeHtml(e.participantName)} · ${timeAgo}
          ${badges}
        </span>
      </div>
      <span class="le-pts" style="color:${ptsColor}">${pts}</span>
      ${deleteBtn}
    </div>`;
}

// ── Conferma ed elimina ───────────────────────────────────

function confirmDelete(entry) {
  const pts    = entry.finalPoints >= 0 ? `+${entry.finalPoints}` : `${entry.finalPoints}`;
  const storno = entry.finalPoints >= 0 ? `-${entry.finalPoints}` : `+${Math.abs(entry.finalPoints)}`;

  openModal(`
    <div class="modal-header">
      <h3 class="modal-title">Elimina voce</h3>
      <button class="modal-close btn" id="ml-close">×</button>
    </div>
    <p style="margin: var(--space-md) 0">
      Eliminare <strong>${escapeHtml(entry.activityEmoji)} ${escapeHtml(entry.activityName)}</strong>
      loggata da <strong>${escapeHtml(entry.participantName)}</strong>?<br><br>
      I punti <strong>${pts}</strong> verranno stornati (${storno} a ${escapeHtml(entry.participantName)}).
    </p>
    <div class="modal-footer">
      <button class="btn btn-ghost"  id="ml-cancel">Annulla</button>
      <button class="btn btn-danger" id="ml-confirm">Elimina e storna</button>
    </div>`);

  document.getElementById('ml-close').onclick  = closeModal;
  document.getElementById('ml-cancel').onclick = closeModal;
  document.getElementById('ml-confirm').onclick = async () => {
    closeModal();
    try {
      await deleteLogEntry(_projectId, entry);
      showToast(`Voce eliminata · ${storno} pt a ${entry.participantName}`);
    } catch (err) {
      console.error(err);
      showToast('Errore nell\'eliminazione. Riprova.', 'error');
    }
  };
}
