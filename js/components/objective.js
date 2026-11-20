import { escapeHtml } from '../utils.js';

let _celebrationShown = false;

export function mountObjective(container, project, scores) {
  const obj = project?.currentObjective;
  if (!obj?.title) { container.innerHTML = ''; return; }

  const { title, targetPoints, rewardDescription, targetParticipantId } = obj;
  const primary = project.theme?.primaryColor ?? '#6C63FF';

  // Calcola punti correnti per il target
  let currentPoints;
  let targetLabel = '';

  if (targetParticipantId) {
    currentPoints = scores[targetParticipantId] ?? 0;
    const p = project.participants?.find(p => p.id === targetParticipantId);
    targetLabel = p ? `${p.emoji} ${p.name}` : '';
  } else {
    // "Chiunque" — usa il punteggio più alto
    const values = Object.values(scores);
    currentPoints = values.length > 0 ? Math.max(...values) : 0;
    targetLabel = 'Chiunque';
  }

  const pct     = Math.min(100, Math.round((currentPoints / targetPoints) * 100));
  const reached = currentPoints >= targetPoints;

  if (reached && !_celebrationShown) {
    _celebrationShown = true;
    setTimeout(triggerConfetti, 400);
  }

  container.innerHTML = reached
    ? reachedHTML(obj, primary)
    : progressHTML(title, currentPoints, targetPoints, pct, rewardDescription, targetLabel, primary);
}

export function resetCelebration() {
  _celebrationShown = false;
}

// ── HTML helpers ──────────────────────────────────────────

function progressHTML(title, current, target, pct, reward, label, primary) {
  return `
    <div class="objective-card">
      <div class="obj-header">
        <span class="obj-icon">🎯</span>
        <div class="obj-info">
          <strong class="obj-title">${escapeHtml(title)}</strong>
          ${reward ? `<span class="obj-reward">🏆 ${escapeHtml(reward)}</span>` : ''}
        </div>
        <span class="obj-counter">${current} / ${target}</span>
      </div>
      <div class="obj-bar-track">
        <div class="obj-bar-fill" style="width:${pct}%; background:${primary}"></div>
      </div>
      <div class="obj-footer">
        <span class="obj-label">${escapeHtml(label)}</span>
        <span class="obj-pct">${pct}%</span>
      </div>
    </div>`;
}

function reachedHTML(obj, primary) {
  return `
    <div class="objective-card objective-reached" style="border-color:${primary}">
      <div class="obj-celebration">
        <span class="obj-trophy">🏆</span>
        <div>
          <strong class="obj-title">${escapeHtml(obj.title)} — RAGGIUNTO!</strong>
          ${obj.rewardDescription
            ? `<span class="obj-reward">${escapeHtml(obj.rewardDescription)}</span>`
            : ''}
        </div>
      </div>
      <div class="obj-bar-track">
        <div class="obj-bar-fill" style="width:100%; background:${primary}"></div>
      </div>
    </div>`;
}

// ── Confetti ──────────────────────────────────────────────

function triggerConfetti() {
  if (typeof confetti === 'undefined') return;
  const opts = { spread: 90, origin: { y: 0.55 } };
  confetti({ ...opts, particleCount: 120 });
  setTimeout(() => confetti({ ...opts, particleCount: 80, angle: 120 }), 350);
  setTimeout(() => confetti({ ...opts, particleCount: 80, angle: 60  }), 700);
}
