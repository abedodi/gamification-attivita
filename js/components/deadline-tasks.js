import { logActivity }              from '../firebase.js';
import { getCurrentUser }           from '../auth.js';
import { getDeadlineState, formatDate, showToast } from '../utils.js';
import { openParticipantModal }     from './log-modal.js';
import { checkBadgesAfterLog }     from './badges.js';

export function mountDeadlineTasks(container, project, activities) {
  const tasks = activities.filter(a => a.type === 'deadline' && a.active);
  const active = tasks.filter(a => getDeadlineState(a) !== 'done');

  if (active.length === 0) { container.innerHTML = ''; return; }

  const user    = getCurrentUser();
  const isAdmin = !!(user && user.uid === project.ownerUid);

  container.innerHTML = `
    <div class="deadline-section">
      <h2 class="section-title">⏰ Scadenze</h2>
      <div class="deadline-list" id="deadline-list">
        ${active.map(a => deadlineCardHTML(a, project, isAdmin)).join('')}
      </div>
    </div>`;

  // Click su card (stati open/due_soon) → log completion come attività normale
  container.querySelectorAll('.deadline-card:not(.deadline-overdue)').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return; // ignore button clicks
      const actId = card.dataset.id;
      const act = active.find(a => a.id === actId);
      if (act) openCompletionModal(project, act);
    });
  });

  // Bottoni admin
  if (isAdmin) {
    container.querySelectorAll('.btn-apply-penalty').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = active.find(a => a.id === btn.dataset.id);
        if (act) openPenaltyModal(project, act);
      });
    });
    container.querySelectorAll('.btn-mark-done').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = active.find(a => a.id === btn.dataset.id);
        if (act) openCompletionModal(project, act);
      });
    });
  }
}

// ── Card HTML ─────────────────────────────────────────────

function deadlineCardHTML(a, project, isAdmin) {
  const state   = getDeadlineState(a);
  const dl      = formatDate(a.deadline);
  const pts     = a.points >= 0 ? `+${a.points}` : `${a.points}`;
  const penPts  = a.penaltyPoints ?? 0;
  const blocked = isActionBlocked(project.id, a.id);

  const stateInfo = {
    open:     { cls: '',                    badge: '',             label: `Scade il ${dl}` },
    due_soon: { cls: 'deadline-due-soon',   badge: '🟡 In scadenza', label: `Scade il ${dl}` },
    overdue:  { cls: 'deadline-overdue',    badge: '🔴 SCADUTO',  label: `Scadeva il ${dl}` },
  }[state] ?? { cls: '', badge: '', label: '' };

  const adminButtons = (isAdmin && state === 'overdue') ? `
    <div class="deadline-admin-actions">
      <button class="btn btn-danger btn-sm btn-apply-penalty" data-id="${a.id}"
              ${blocked ? 'disabled' : ''} title="Registra la mancata esecuzione">
        ⚠️ Applica Penalità ${penPts}
      </button>
      <button class="btn btn-success btn-sm btn-mark-done" data-id="${a.id}"
              ${blocked ? 'disabled' : ''} title="Il task era stato fatto, solo non loggato">
        ✓ Segna Completato
      </button>
      ${blocked ? '<span class="form-hint">Azione già eseguita oggi</span>' : ''}
    </div>` : '';

  return `
    <div class="deadline-card ${stateInfo.cls}" data-id="${a.id}">
      <div class="dc-top">
        <span class="dc-emoji">${a.emoji}</span>
        <div class="dc-info">
          <span class="dc-name">${a.name}</span>
          <span class="dc-meta">${stateInfo.label}</span>
        </div>
        <div class="dc-right">
          ${stateInfo.badge ? `<span class="dc-badge">${stateInfo.badge}</span>` : ''}
          <span class="dc-pts" style="color:${a.points>=0?'var(--color-success)':'var(--color-danger)'}">${pts}</span>
        </div>
      </div>
      ${adminButtons}
    </div>`;
}

// ── Modal flows ───────────────────────────────────────────

function openCompletionModal(project, activity) {
  openParticipantModal(project, activity, {
    onConfirm: async (participantId, participantName) => {
      await submit(project, participantId, participantName, activity, 'completion');
    },
  });
}

function openPenaltyModal(project, activity) {
  const penPts = activity.penaltyPoints ?? 0;
  openParticipantModal(project, activity, {
    ptsOverride: penPts,
    onConfirm: async (participantId, participantName) => {
      await submit(project, participantId, participantName, activity, 'penalty');
      markActionDone(project.id, activity.id);
    },
  });
}

async function submit(project, participantId, participantName, activity, type) {
  try {
    await logActivity({ projectId: project.id, participantId, participantName, activity, type, loggedBy: 'admin' });
    if (type === 'penalty') {
      showToast(`Penalità applicata: ${activity.penaltyPoints ?? 0} pt → ${participantName}`);
    } else {
      showToast(`✓ ${activity.name} completato da ${participantName}`);
    }
    if (type === 'completion') {
      markActionDone(project.id, activity.id);
      checkBadgesAfterLog(project.id, participantId); // non-blocking
    }
  } catch (err) {
    console.error(err);
    showToast('Errore. Riprova.', 'error');
  }
}

// ── Anti-double-action (localStorage, 1 azione per giorno) ──

function actionKey(projectId, activityId) {
  const today = new Date().toISOString().slice(0, 10);
  return `ga_act_${projectId}_${activityId}_${today}`;
}
function isActionBlocked(projectId, activityId) {
  return !!localStorage.getItem(actionKey(projectId, activityId));
}
function markActionDone(projectId, activityId) {
  localStorage.setItem(actionKey(projectId, activityId), '1');
}
