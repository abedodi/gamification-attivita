import { escapeHtml } from '../utils.js';

export function mountScoreboard(container, project, scores) {
  const { participants = [], participantMode } = project;
  if (participantMode === 'teams' && participants.length === 2) {
    renderTugOfWar(container, participants, scores, project.theme);
  } else {
    renderRanking(container, participants, scores);
  }
}

// ── Tug-of-war (2 squadre) ────────────────────────────────

function renderTugOfWar(container, participants, scores, theme) {
  const [a, b]   = participants;
  const ptsA     = scores[a.id] ?? 0;
  const ptsB     = scores[b.id] ?? 0;
  const total    = ptsA + ptsB;
  const pctA     = total === 0 ? 50 : Math.round((ptsA / total) * 100);
  const pctB     = 100 - pctA;
  const primary  = theme?.primaryColor ?? 'var(--color-primary)';
  const leading  = ptsA >= ptsB ? a : b;
  const leadPts  = Math.max(ptsA, ptsB);
  const diff     = Math.abs(ptsA - ptsB);

  container.innerHTML = `
    <div class="scoreboard scoreboard-tug">
      <div class="tug-teams">
        <div class="tug-team tug-team-a ${ptsA >= ptsB ? 'leading' : ''}">
          <span class="tug-emoji">${escapeHtml(a.emoji)}</span>
          <span class="tug-name">${escapeHtml(a.name)}</span>
          <span class="tug-pts">${ptsA} pt</span>
        </div>
        <div class="tug-team tug-team-b ${ptsB > ptsA ? 'leading' : ''}">
          <span class="tug-pts">${ptsB} pt</span>
          <span class="tug-name">${escapeHtml(b.name)}</span>
          <span class="tug-emoji">${escapeHtml(b.emoji)}</span>
        </div>
      </div>
      <div class="tug-bar-wrap">
        <div class="tug-bar">
          <div class="tug-fill tug-fill-a" style="width:${pctA}%; background:${primary}"></div>
          <div class="tug-fill tug-fill-b" style="width:${pctB}%"></div>
        </div>
        <div class="tug-rope-knot" style="left:${pctA}%"></div>
      </div>
      ${diff > 0 ? `<p class="tug-lead-label">${escapeHtml(leading.emoji)} <strong>${escapeHtml(leading.name)}</strong> in vantaggio di ${diff} pt</p>` : '<p class="tug-lead-label">Pareggio! 🤝</p>'}
    </div>`;
}

// ── Classifica (N partecipanti) ───────────────────────────

function renderRanking(container, participants, scores) {
  const sorted = [...participants]
    .map(p => ({ ...p, points: scores[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points);

  const medals = ['🥇', '🥈', '🥉'];

  container.innerHTML = `
    <div class="scoreboard scoreboard-ranking">
      ${sorted.map((p, i) => `
        <div class="rank-row ${i === 0 ? 'rank-first' : ''}">
          <span class="rank-medal">${medals[i] ?? `${i + 1}.`}</span>
          <span class="rank-emoji">${escapeHtml(p.emoji)}</span>
          <span class="rank-name">${escapeHtml(p.name)}</span>
          <span class="rank-pts">${p.points} <small>pt</small></span>
        </div>`).join('')}
    </div>`;
}
