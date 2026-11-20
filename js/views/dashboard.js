import { subscribeUserProjects, saveUser } from '../firebase.js';
import { getCurrentUser, signOut }         from '../auth.js';
import { navigate, registerUnmount }       from '../router.js';
import { getPlayUrl, copyToClipboard, escapeHtml, showToast } from '../utils.js';

let _unsub = null;

export function mount() {
  const user = getCurrentUser();

  // Header: nome utente
  document.getElementById('user-name').textContent = user.displayName || user.email;

  // Salva/aggiorna profilo utente su Firestore
  saveUser(user.uid, {
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
  });

  // Logout
  document.getElementById('btn-logout').onclick = async () => {
    await signOut();
    // onAuthChange in app.js gestirà il redirect a /
  };

  // Nuovo progetto
  document.getElementById('btn-new-project').onclick = () => navigate('/edit/new');

  // Sottoscrizione real-time ai progetti dell'utente
  _unsub = subscribeUserProjects(user.uid, projects => renderProjects(projects));

  registerUnmount(() => { if (_unsub) { _unsub(); _unsub = null; } });
}

// ── Rendering ─────────────────────────────────────────────

function renderProjects(projects) {
  const grid = document.getElementById('projects-grid');

  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">🎯</div>
        <h2>Nessun progetto ancora</h2>
        <p>Crea il tuo primo gioco a punti e condividi il link con i partecipanti!</p>
        <button class="btn btn-primary" id="btn-empty-create">+ Crea il primo progetto</button>
      </div>`;
    document.getElementById('btn-empty-create').onclick = () => navigate('/edit/new');
    return;
  }

  // Ordina per data creazione (più recente in cima)
  const sorted = [...projects].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });

  grid.innerHTML = sorted.map(p => cardHTML(p)).join('');

  sorted.forEach(p => {
    document.getElementById(`btn-play-${p.id}`)
      ?.addEventListener('click', () => navigate(`/play/${p.id}`));
    document.getElementById(`btn-edit-${p.id}`)
      ?.addEventListener('click', () => navigate(`/edit/${p.id}`));
    document.getElementById(`btn-share-${p.id}`)
      ?.addEventListener('click', () => shareProject(p));
  });
}

function cardHTML(p) {
  const color   = p.theme?.primaryColor ?? '#6C63FF';
  const emoji   = p.theme?.emoji ?? '🎯';
  const mode    = p.participantMode === 'individuals' ? 'Individuale' : 'Squadre';
  const nPart   = p.participants?.length ?? 0;
  const desc    = p.description ? `<p class="project-card-desc">${escapeHtml(p.description)}</p>` : '';

  return `
    <article class="project-card" style="--card-accent: ${color}">
      <div class="project-card-top">
        <span class="project-card-emoji">${emoji}</span>
        <div class="project-card-meta">
          <span class="chip">${mode}</span>
          <span class="chip">${nPart} ${nPart === 1 ? 'partecipante' : 'partecipanti'}</span>
        </div>
      </div>
      <h3 class="project-card-name">${escapeHtml(p.name)}</h3>
      ${desc}
      <div class="project-card-actions">
        <button id="btn-play-${p.id}"  class="btn btn-primary btn-sm">▶ Gioca</button>
        <button id="btn-edit-${p.id}"  class="btn btn-ghost   btn-sm">✏️ Gestisci</button>
        <button id="btn-share-${p.id}" class="btn btn-ghost   btn-sm" title="Copia link">🔗</button>
      </div>
    </article>`;
}

async function shareProject(p) {
  try {
    await copyToClipboard(getPlayUrl(p.id));
    showToast('Link copiato! Condividilo con i partecipanti.');
  } catch {
    showToast('Impossibile copiare il link.', 'error');
  }
}
