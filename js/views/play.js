import { subscribeProject, subscribeScores, subscribeActivities } from '../firebase.js';
import { getCurrentUser }                                          from '../auth.js';
import { navigate, registerUnmount }                              from '../router.js';
import { applyTheme, resetTheme, getPlayUrl,
         copyToClipboard, openModal, closeModal, showToast }       from '../utils.js';
import { mountScoreboard }                                        from '../components/scoreboard.js';
import { mountActivitiesGrid, openLogModalFAB }                   from '../components/activities-grid.js';
import { mountDeadlineTasks }                                      from '../components/deadline-tasks.js';
import { mountRecurringTasks }                                     from '../components/recurring-tasks.js';
import { mountLogHistory, unmountLogHistory }                      from '../components/log-history.js';
import { mountEventBanner }                                        from '../components/event-banner.js';
import { mountObjective, resetCelebration }                       from '../components/objective.js';

let _unsubs   = [];
let _project  = null;
let _scores   = {};
let _activities = [];

export function mount({ projectId }) {
  _unsubs   = [];
  _project  = null;
  _scores   = {};
  _activities = [];

  // Sottoscrizione progetto
  _unsubs.push(subscribeProject(projectId, project => {
    if (!project) { navigate('/'); return; }
    _project = project;
    applyTheme(project);
    renderHeader(project);
    renderEventBanner();
    renderScoreboard();
    renderObjective();
    renderActivities();
  }));

  // Sottoscrizione punteggi (aggiornamento real-time indipendente)
  _unsubs.push(subscribeScores(projectId, scores => {
    _scores = scores;
    renderScoreboard();
    renderObjective();   // il progresso dipende anche dai punteggi
  }));

  // Sottoscrizione attività
  _unsubs.push(subscribeActivities(projectId, activities => {
    _activities = activities;
    if (_project) _project._cachedActivities = activities;
    renderActivities();
    renderDeadlineTasks();
    renderRecurringTasks();
  }));

  // FAB "Registra"
  document.getElementById('btn-log-activity').onclick = () => {
    if (!_project || !_activities.length) return;
    _project._cachedActivities = _activities;
    openLogModalFAB(_project, _activities);
  };

  // Storico toggle
  document.getElementById('btn-show-log').onclick  = () => toggleLog(true);
  document.getElementById('btn-close-log').onclick = () => toggleLog(false);

  // Share
  document.getElementById('btn-share-play').onclick = () => {
    if (_project) openShareModal(_project);
  };

  // Monta lo storico (subscription sempre attiva)
  mountLogHistory(
    document.getElementById('log-history-container'),
    projectId,
  );

  registerUnmount(cleanup);
}

// ── Cleanup ───────────────────────────────────────────────

function cleanup() {
  _unsubs.forEach(u => u());
  _unsubs = [];
  unmountLogHistory();
  resetCelebration();
  resetTheme();
  document.getElementById('log-history-panel').classList.add('hidden');
}

// ── Header ────────────────────────────────────────────────

function renderHeader(project) {
  document.getElementById('project-emoji-header').textContent = project.theme?.emoji ?? '🎯';
  document.getElementById('project-name-header').textContent  = project.name ?? '';

  const user    = getCurrentUser();
  const isAdmin = user && user.uid === project.ownerUid;

  document.getElementById('admin-badge')       .classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-admin-manage')  .classList.toggle('hidden', !isAdmin);

  if (isAdmin) {
    document.getElementById('btn-admin-manage').onclick = () =>
      navigate(`/edit/${project.id}`);
  }
}

// ── Event Banner ─────────────────────────────────────────

function renderEventBanner() {
  if (!_project) return;
  mountEventBanner(
    document.getElementById('event-banner-container'),
    _project,
  );
}

// ── Objective ─────────────────────────────────────────────

function renderObjective() {
  if (!_project) return;
  mountObjective(
    document.getElementById('objective-container'),
    _project,
    _scores,
  );
}

// ── Scoreboard ────────────────────────────────────────────

function renderScoreboard() {
  if (!_project) return;
  mountScoreboard(
    document.getElementById('scoreboard-container'),
    _project,
    _scores,
  );
}

// ── Attività ──────────────────────────────────────────────

function renderActivities() {
  if (!_project) return;
  mountActivitiesGrid(
    document.getElementById('activities-grid-container'),
    _project,
    _activities,
  );
}

function renderDeadlineTasks() {
  if (!_project) return;
  mountDeadlineTasks(
    document.getElementById('deadline-tasks-container'),
    _project,
    _activities,
  );
}

function renderRecurringTasks() {
  if (!_project) return;
  mountRecurringTasks(
    document.getElementById('recurring-tasks-container'),
    _project,
    _activities,
  );
}

// ── Storico toggle ────────────────────────────────────────

function toggleLog(show) {
  document.getElementById('log-history-panel').classList.toggle('hidden', !show);
  document.getElementById('btn-log-activity') .classList.toggle('hidden', show);
}

// ── Share modal ───────────────────────────────────────────

function openShareModal(project) {
  const url    = getPlayUrl(project.id);
  const qrSrc  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  openModal(`
    <div class="modal-header">
      <h3 class="modal-title">Condividi ${escapeHtml(project.theme?.emoji ?? '🎯')} ${escapeHtml(project.name)}</h3>
      <button class="modal-close btn" id="ml-close">×</button>
    </div>
    <div class="share-content">
      <img src="${qrSrc}" alt="QR Code" class="share-qr" loading="lazy">
      <p class="share-hint">Scansiona il QR o copia il link</p>
      <code class="share-url">${url}</code>
      <button id="btn-copy-share" class="btn btn-primary">📋 Copia link</button>
    </div>`);

  document.getElementById('ml-close').onclick       = closeModal;
  document.getElementById('btn-copy-share').onclick = async () => {
    await copyToClipboard(url);
    showToast('Link copiato! Condividilo con i partecipanti.');
    closeModal();
  };
}

// escapeHtml locale (evita import circolare)
function escapeHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
