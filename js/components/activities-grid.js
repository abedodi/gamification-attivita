import { logActivity }                           from '../firebase.js';
import { escapeHtml, openModal, closeModal, showToast } from '../utils.js';
import { openParticipantModal }                  from './log-modal.js';
import { getActiveMultiplier }                   from './event-banner.js';
import { checkBadgesAfterLog }                   from './badges.js';

// ── Mount ─────────────────────────────────────────────────

export function mountActivitiesGrid(container, project, activities) {
  const standard = activities.filter(a => a.active && (a.type === 'standard' || !a.type));
  if (standard.length === 0) {
    container.innerHTML = '<p class="empty-hint">Nessuna attività standard disponibile.</p>';
    return;
  }

  container.innerHTML = `
    <div class="activities-section">
      <h2 class="section-title">Attività</h2>
      <div class="activities-grid">
        ${standard.map(a => activityCardHTML(a)).join('')}
      </div>
    </div>`;

  container.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', () => {
      const actId = card.dataset.id;
      const act   = standard.find(a => a.id === actId);
      if (act) openLogModal(project, standard, act);
    });
  });
}

// ── Trigger dal FAB (nessuna attività pre-selezionata) ────

export function openLogModalFAB(project, activities) {
  const standard = activities.filter(a => a.active && (a.type === 'standard' || !a.type));
  openLogModal(project, standard, null);
}

// ── Card HTML ─────────────────────────────────────────────

function activityCardHTML(a) {
  const pts   = a.points >= 0 ? `+${a.points}` : `${a.points}`;
  const color = a.points >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  return `
    <button class="activity-card" data-id="${a.id}">
      <span class="ac-emoji">${escapeHtml(a.emoji)}</span>
      <span class="ac-name">${escapeHtml(a.name)}</span>
      <span class="ac-pts" style="color:${color}">${pts}</span>
    </button>`;
}

// ── Log Modal ─────────────────────────────────────────────

function openLogModal(project, activities, preselected) {
  if (preselected) {
    showParticipantStep(project, preselected);
  } else {
    showActivityStep(project, activities);
  }
}

// Step A: scegli attività (dal FAB)
function showActivityStep(project, activities) {
  openModal(`
    <div class="modal-header">
      <h3 class="modal-title">Quale attività?</h3>
      <button class="modal-close btn" id="ml-close">×</button>
    </div>
    <div class="log-modal-activities">
      ${activities.map(a => {
        const pts   = a.points >= 0 ? `+${a.points}` : `${a.points}`;
        const color = a.points >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
        return `<button class="log-act-row" data-id="${a.id}">
          <span class="la-emoji">${escapeHtml(a.emoji)}</span>
          <span class="la-name">${escapeHtml(a.name)}</span>
          <span class="la-pts" style="color:${color}">${pts}</span>
        </button>`;
      }).join('')}
    </div>`);

  document.getElementById('ml-close').onclick = closeModal;
  document.querySelectorAll('.log-act-row').forEach(row => {
    row.addEventListener('click', () => {
      const act = activities.find(a => a.id === row.dataset.id);
      if (act) showParticipantStep(project, act);
    });
  });
}

// Step B: scegli partecipante (delegato a log-modal.js)
function showParticipantStep(project, activity) {
  openParticipantModal(project, activity, {
    onConfirm: (participantId, participantName) =>
      submitLog(project, participantId, participantName, activity),
    onBack: () => openLogModal(project, project._cachedActivities ?? [], null),
  });
}

// ── Submit ────────────────────────────────────────────────

async function submitLog(project, participantId, participantName, activity) {
  closeModal();
  try {
    await logActivity({
      projectId: project.id,
      participantId,
      participantName,
      activity,
      multiplier: getActiveMultiplier(project),
      type: 'completion',
      loggedBy: 'anonymous',
    });
    const pts = activity.points * getActiveMultiplier(project);
    const sign = pts >= 0 ? '+' : '';
    showToast(`${sign}${pts} pt → ${participantName} ${activity.emoji}`);
    checkBadgesAfterLog(project.id, participantId); // non-blocking
  } catch (err) {
    console.error(err);
    showToast('Errore nella registrazione. Riprova.', 'error');
  }
}

