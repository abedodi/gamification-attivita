import { escapeHtml, toDate } from '../utils.js';

export function mountEventBanner(container, project) {
  const ev = project?.activeEvent;
  if (!ev?.title) { container.innerHTML = ''; return; }

  const now   = new Date();
  const start = toDate(ev.startDate);
  const end   = toDate(ev.endDate);

  if (!start || !end || now < start || now > end) {
    container.innerHTML = '';
    return;
  }

  const primary = project.theme?.primaryColor ?? '#6C63FF';

  container.innerHTML = `
    <div class="event-banner" style="--eb-color: ${primary}">
      <span class="eb-emoji">${escapeHtml(ev.emoji ?? '🎉')}</span>
      <div class="eb-info">
        <strong class="eb-title">${escapeHtml(ev.title)}</strong>
        <span class="eb-subtitle">Tutti i punti vengono moltiplicati!</span>
      </div>
      <span class="eb-multiplier">×${ev.multiplier ?? 2}</span>
    </div>`;
}

/**
 * Ritorna il moltiplicatore attivo per il progetto in questo momento.
 * Usato da activities-grid, deadline-tasks, recurring-tasks prima del log.
 */
export function getActiveMultiplier(project) {
  const ev = project?.activeEvent;
  if (!ev) return 1;
  const now   = new Date();
  const start = toDate(ev.startDate);
  const end   = toDate(ev.endDate);
  if (!start || !end || now < start || now > end) return 1;
  return ev.multiplier ?? 1;
}
