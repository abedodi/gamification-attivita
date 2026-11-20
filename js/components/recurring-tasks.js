import { logActivity }                           from '../firebase.js';
import { getRecurringTaskState, getNextReset,
         showToast }                              from '../utils.js';
import { openParticipantModal }                   from './log-modal.js';
import { checkBadgesAfterLog }                    from './badges.js';
import { getCurrentUser }                         from '../auth.js';

export function mountRecurringTasks(container, project, activities) {
  const tasks = activities.filter(a => a.type === 'recurring' && a.active);
  if (tasks.length === 0) { container.innerHTML = ''; return; }

  const user    = getCurrentUser();
  const isAdmin = !!(user && user.uid === project.ownerUid);
  const now     = new Date();

  const open      = tasks.filter(a => getRecurringTaskState(a, now) === 'open');
  const completed = tasks.filter(a => getRecurringTaskState(a, now) === 'completed_this_cycle');

  container.innerHTML = `
    <div class="recurring-section">
      <h2 class="section-title">🔄 Ricorrenti</h2>

      ${open.length > 0 ? `
        <div class="recurring-subsection">
          <p class="recurring-sublabel">Da fare</p>
          <div class="recurring-list" id="recurring-open">
            ${open.map(a => recurringCardHTML(a, false, project, isAdmin)).join('')}
          </div>
        </div>` : ''}

      ${completed.length > 0 ? `
        <div class="recurring-subsection">
          <p class="recurring-sublabel">Già fatti</p>
          <div class="recurring-list" id="recurring-done">
            ${completed.map(a => recurringCardHTML(a, true, project, isAdmin)).join('')}
          </div>
        </div>` : ''}
    </div>`;

  // Click su card aperta → log
  container.querySelectorAll('.recurring-card.rc-open').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const act = open.find(a => a.id === card.dataset.id);
      if (act) openCompletionModal(project, act);
    });
  });

  // Bottoni admin su card completata (Segna Completato per ciclo perso)
  if (isAdmin) {
    container.querySelectorAll('.btn-rc-force').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = tasks.find(a => a.id === btn.dataset.id);
        if (act) openCompletionModal(project, act);
      });
    });
  }
}

// ── Card HTML ─────────────────────────────────────────────

function recurringCardHTML(a, isDone, project, isAdmin) {
  const pts        = a.points >= 0 ? `+${a.points}` : `${a.points}`;
  const ptsColor   = a.points >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  const recLabel   = { daily: 'Giornaliero', weekly: 'Settimanale', monthly: 'Mensile' }[a.recurrence] ?? '';
  const nextReset  = getNextReset(a.recurrence);

  if (isDone) {
    return `
      <div class="recurring-card rc-done" data-id="${a.id}">
        <span class="rc-check">✓</span>
        <span class="rc-emoji">${a.emoji}</span>
        <div class="rc-info">
          <span class="rc-name">${a.name}</span>
          <span class="rc-meta">Prossimo reset: ${nextReset}</span>
        </div>
        <span class="rc-badge">${recLabel}</span>
        ${isAdmin ? `<button class="btn btn-ghost btn-sm btn-rc-force" data-id="${a.id}" title="Registra per questo ciclo">+</button>` : ''}
      </div>`;
  }

  return `
    <div class="recurring-card rc-open" data-id="${a.id}">
      <span class="rc-emoji">${a.emoji}</span>
      <div class="rc-info">
        <span class="rc-name">${a.name}</span>
        <span class="rc-meta">${recLabel}</span>
      </div>
      <span class="rc-pts" style="color:${ptsColor}">${pts}</span>
    </div>`;
}

// ── Modal + submit ────────────────────────────────────────

function openCompletionModal(project, activity) {
  openParticipantModal(project, activity, {
    onConfirm: async (participantId, participantName) => {
      try {
        await logActivity({
          projectId: project.id,
          participantId,
          participantName,
          activity,
          type: 'completion',
          loggedBy: 'anonymous',
        });
        showToast(`+${activity.points} pt → ${participantName} 🔄`);
        checkBadgesAfterLog(project.id, participantId); // non-blocking
      } catch (err) {
        console.error(err);
        showToast('Errore. Riprova.', 'error');
      }
    },
  });
}
