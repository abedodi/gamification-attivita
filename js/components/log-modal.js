import { escapeHtml, openModal, closeModal } from '../utils.js';

/**
 * Apre il modal di selezione partecipante.
 * onConfirm(participantId, participantName) viene chiamato al click.
 * onBack() (opzionale) viene chiamato al click su "← Indietro".
 */
export function openParticipantModal(project, activity, { onConfirm, onBack, ptsOverride } = {}) {
  const pts    = ptsOverride !== undefined ? ptsOverride
               : (activity.points >= 0 ? `+${activity.points}` : `${activity.points}`);
  const isNeg  = String(pts).startsWith('-');
  const color  = isNeg ? 'var(--color-danger)' : 'var(--color-success)';
  const pLabel = project.participantMode === 'individuals' ? 'Chi lo ha fatto?' : 'Per quale squadra?';
  const primary = project.theme?.primaryColor ?? 'var(--color-primary)';

  openModal(`
    <div class="modal-header">
      <h3 class="modal-title">${escapeHtml(activity.emoji)} ${escapeHtml(activity.name)}</h3>
      <button class="modal-close btn" id="ml-close">×</button>
    </div>
    <div class="log-activity-preview">
      <span class="lap-pts" style="color:${color}">${pts} punti</span>
    </div>
    <p class="log-modal-label">${escapeHtml(pLabel)}</p>
    <div class="log-participants">
      ${project.participants.map(p => `
        <button class="log-part-card" data-id="${p.id}" data-name="${escapeHtml(p.name)}"
                style="--part-color:${primary}">
          <span class="lp-emoji">${escapeHtml(p.emoji)}</span>
          <span class="lp-name">${escapeHtml(p.name)}</span>
        </button>`).join('')}
    </div>
    ${onBack ? `<div class="modal-footer">
      <button class="btn btn-ghost" id="ml-back">← Indietro</button>
    </div>` : ''}`);

  document.getElementById('ml-close').onclick = closeModal;
  document.getElementById('ml-back')?.addEventListener('click', () => { closeModal(); onBack(); });

  document.querySelectorAll('.log-part-card').forEach(card => {
    card.addEventListener('click', () => {
      closeModal();
      onConfirm(card.dataset.id, card.dataset.name);
    });
  });
}
