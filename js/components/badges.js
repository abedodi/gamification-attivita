import { db, awardBadge }                      from '../firebase.js';
import { collection, getDocs, getDoc,
         doc, query, where }                   from '../firebase.js';
import { openModal, closeModal, escapeHtml }   from '../utils.js';

// ── Cache session-level per badge definitions ─────────────
const _badgeCache = {};   // projectId → Badge[]

// ── Entry point: chiamato dopo ogni log riuscito ──────────

export async function checkBadgesAfterLog(projectId, participantId) {
  try {
    const [badges, stats] = await Promise.all([
      loadBadges(projectId),
      loadStats(projectId, participantId),
    ]);
    if (!badges.length) return;

    // Carica i badge già assegnati al partecipante
    const awardedSnap = await getDocs(query(
      collection(db, 'projects', projectId, 'awardedBadges'),
      where('participantId', '==', participantId)
    ));
    const alreadyOwned = new Set(awardedSnap.docs.map(d => d.data().badgeId));

    // Verifica ogni badge non ancora assegnato
    for (const badge of badges) {
      if (alreadyOwned.has(badge.id)) continue;
      if (evalCondition(badge.condition, stats)) {
        const awarded = await awardBadge(projectId, participantId, badge);
        if (awarded) {
          showBadgeModal(badge);
          break; // Mostra un badge alla volta
        }
      }
    }
  } catch (err) {
    console.warn('Badge check failed:', err);
  }
}

// ── Carica definizioni (con cache) ────────────────────────

async function loadBadges(projectId) {
  if (_badgeCache[projectId]) return _badgeCache[projectId];
  const snap = await getDocs(collection(db, 'projects', projectId, 'badges'));
  _badgeCache[projectId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return _badgeCache[projectId];
}

export function invalidateBadgeCache(projectId) {
  delete _badgeCache[projectId];
}

// ── Statistiche partecipante ──────────────────────────────

async function loadStats(projectId, participantId) {
  const [scoreSnap, logsSnap] = await Promise.all([
    getDoc(doc(db, 'projects', projectId, 'scores', participantId)),
    getDocs(query(
      collection(db, 'projects', projectId, 'log'),
      where('participantId', '==', participantId),
      where('type', '==', 'completion'),
    )),
  ]);

  return {
    pointsTotal: scoreSnap.data()?.points ?? 0,
    logCount:    logsSnap.size,
    streakDays:  calcStreak(logsSnap.docs),
  };
}

function calcStreak(logDocs) {
  const days = new Set();
  logDocs.forEach(d => {
    const ts = d.data().timestamp?.toDate?.();
    if (ts) days.add(ts.toISOString().slice(0, 10));
  });
  if (!days.size) return 0;

  const sorted = [...days].sort().reverse(); // newest first
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // La streak conta solo se include oggi o ieri
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const diff = Math.round(
      (new Date(prev).getTime() - new Date(curr).getTime()) / 86400000
    );
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

// ── Valuta condizione ─────────────────────────────────────

function evalCondition(condition, stats) {
  if (!condition) return false;
  switch (condition.type) {
    case 'log_count':    return stats.logCount    >= (condition.threshold ?? 1);
    case 'points_total': return stats.pointsTotal >= (condition.threshold ?? 100);
    case 'streak_days':  return stats.streakDays  >= (condition.threshold ?? 3);
    default: return false;
  }
}

// ── Modal celebrazione badge ──────────────────────────────

function showBadgeModal(badge) {
  openModal(`
    <div class="badge-modal">
      <div class="badge-modal-glow"></div>
      <div class="badge-modal-emoji">${escapeHtml(badge.emoji)}</div>
      <p class="badge-modal-eyebrow">🎉 Badge Sbloccato!</p>
      <h3 class="badge-modal-name">${escapeHtml(badge.name)}</h3>
      <p class="badge-modal-desc">${escapeHtml(badge.description)}</p>
      <div class="modal-footer">
        <button id="btn-badge-ok" class="btn btn-primary">Fantastico!</button>
      </div>
    </div>`);

  document.getElementById('btn-badge-ok').onclick = closeModal;
  triggerBadgeConfetti();
}

function triggerBadgeConfetti() {
  if (typeof confetti === 'undefined') return;
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors: ['#FFD700','#FFA500','#FF6584','#6C63FF'] });
}
