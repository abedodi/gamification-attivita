import { subscribeLog }                    from '../firebase.js';
import { formatRelative, escapeHtml }      from '../utils.js';

let _unsub     = null;
let _pageSize  = 20;
let _container = null;
let _projectId = null;
let _totalShown = 0;

export function mountLogHistory(container, projectId) {
  _container = container;
  _projectId = projectId;
  _pageSize  = 20;
  subscribe();
}

export function unmountLogHistory() {
  if (_unsub) { _unsub(); _unsub = null; }
}

// ── Subscription ──────────────────────────────────────────

function subscribe() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = subscribeLog(_projectId, entries => render(entries), _pageSize);
}

// ── Render ────────────────────────────────────────────────

function render(entries) {
  if (!_container) return;
  _totalShown = entries.length;

  if (entries.length === 0) {
    _container.innerHTML = `
      <div class="log-empty">
        <span>📋</span>
        <p>Nessuna attività ancora.<br>Inizia a registrare!</p>
      </div>`;
    return;
  }

  _container.innerHTML = `
    <div class="log-list">
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
}

// ── Entry HTML ────────────────────────────────────────────

function entryHTML(e) {
  const isPenalty = e.type === 'penalty';
  const pts       = e.finalPoints >= 0 ? `+${e.finalPoints}` : `${e.finalPoints}`;
  const ptsColor  = e.finalPoints >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  const timeAgo   = formatRelative(e.timestamp);

  const badges = [
    isPenalty            ? '<span class="le-badge le-badge-penalty">⚠️ Penalità</span>' : '',
    e.multiplier > 1     ? `<span class="le-badge le-badge-event">×${e.multiplier}</span>` : '',
    e.type === 'completion' && e.activityType === 'recurring'
                         ? '<span class="le-badge le-badge-recurring">🔄</span>' : '',
  ].filter(Boolean).join('');

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
    </div>`;
}
