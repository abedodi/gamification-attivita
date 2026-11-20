import { createProject, updateProject, initScores, seedBadgesIfEmpty,
         subscribeProject, subscribeActivities, saveActivity, deleteActivity,
         saveBadge, deleteBadgeDoc, resetScores,
         STARTER_ACTIVITIES, STARTER_BADGES,
         db, getDocs, collection }             from '../firebase.js';
import { getCurrentUser }                            from '../auth.js';
import { navigate, registerUnmount }                 from '../router.js';
import { applyTheme, resetTheme, generateId,
         escapeHtml, openModal, closeModal, showToast } from '../utils.js';
import { renderParticipantsEditor, setupParticipantsEditor }
                                                     from '../components/participants-editor.js';

// ── Stato editor ──────────────────────────────────────────
let draft = {};
let draftActivities = [];
let draftBadges = [];
let currentStep = 1;
let editingId = null;   // null = nuovo progetto
let _unsubs = [];
const TOTAL_STEPS = 5;

// ── Mount / Unmount ───────────────────────────────────────

export async function mount({ projectId }) {
  currentStep = 1;
  editingId = projectId === 'new' ? null : projectId;
  _unsubs = [];

  if (editingId) {
    draft = await loadExistingProject(editingId);
  } else {
    draft = createEmptyDraft();
    draftActivities = STARTER_ACTIVITIES.map((a, i) => ({
      ...a, id: generateId(), order: i, active: true,
      deadline: null, recurrence: null, lastCompleted: null, status: 'open',
    }));
    draftBadges = STARTER_BADGES.map(b => ({ ...b, id: generateId() }));
  }

  document.getElementById('editor-title').textContent =
    editingId ? 'Modifica progetto' : 'Nuovo progetto';

  document.getElementById('btn-editor-back').onclick  = handleBack;
  document.getElementById('btn-editor-save').onclick  = handleSaveOrNext;

  renderStep();
  registerUnmount(cleanup);
}

function cleanup() {
  _unsubs.forEach(u => u());
  _unsubs = [];
  resetTheme();
}

// ── Navigazione step ──────────────────────────────────────

function goToStep(step) {
  currentStep = step;
  renderStep();
}

function handleBack() {
  if (currentStep > 1) goToStep(currentStep - 1);
  else navigate('/dashboard');
}

async function handleSaveOrNext() {
  try {
    const error = validateStep(currentStep);
    if (error) { showToast(error, 'error'); return; }
    if (currentStep < TOTAL_STEPS) { goToStep(currentStep + 1); return; }
    await saveProject();
  } catch (err) {
    console.error('handleSaveOrNext error:', err);
    showToast('Errore: ' + err.message, 'error');
  }
}

// ── Validazione ───────────────────────────────────────────

function validateStep(step) {
  if (step === 1 && !draft.name.trim()) return 'Inserisci un nome per il progetto.';
  if (step === 2 && draft.participants.length < 2) return 'Aggiungi almeno 2 partecipanti.';
  return null;
}

// ── Render step ───────────────────────────────────────────

function renderStep() {
  updateHeaderButtons();
  renderStepNav();
  const wizard = document.getElementById('editor-wizard');
  const renderers = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];
  wizard.innerHTML = renderers[currentStep]();
  setupStep(currentStep);
}

function updateHeaderButtons() {
  const saveBtn = document.getElementById('btn-editor-save');
  const backBtn = document.getElementById('btn-editor-back');
  saveBtn.textContent = currentStep === TOTAL_STEPS ? '✓ Pubblica' : 'Avanti →';
  backBtn.textContent = currentStep === 1 ? '× Annulla' : '← Indietro';
}

function renderStepNav() {
  const nav = document.getElementById('editor-steps-nav');
  const labels = ['Info', 'Partecipanti', 'Tema', 'Attività', 'Extra'];
  nav.innerHTML = labels.map((label, i) => {
    const n = i + 1;
    const cls = n < currentStep ? 'completed' : n === currentStep ? 'active' : '';
    return `<div class="step-dot ${cls}" title="${label}">
      <span>${n < currentStep ? '✓' : n}</span>
      <small>${label}</small>
    </div>`;
  }).join('<div class="step-line"></div>');
}

// ── Step 1: Info base ─────────────────────────────────────

function renderStep1() {
  return `
    <div class="wizard-step">
      <h2 class="step-title">Informazioni base</h2>
      <div class="step-row">
        <div class="form-group" style="flex:0 0 72px">
          <label class="form-label">Emoji</label>
          <input id="f-emoji" class="form-input emoji-input" value="${escapeHtml(draft.theme.emoji)}" maxlength="2">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Nome progetto <span class="required">*</span></label>
          <input id="f-name" class="form-input" placeholder="es. Trofeo di Casa 2025" value="${escapeHtml(draft.name)}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrizione <span class="form-hint">(opzionale)</span></label>
        <textarea id="f-desc" class="form-input" rows="2" placeholder="Breve descrizione del gioco…">${escapeHtml(draft.description)}</textarea>
      </div>
    </div>`;
}

function setupStep1() {
  document.getElementById('f-name').oninput  = e => { draft.name = e.target.value; };
  document.getElementById('f-emoji').oninput = e => { draft.theme.emoji = e.target.value; };
  document.getElementById('f-desc').oninput  = e => { draft.description = e.target.value; };
  document.getElementById('f-name').focus();
}

// ── Step 2: Partecipanti ──────────────────────────────────

function renderStep2() {
  return `<div class="wizard-step">
    <h2 class="step-title">Partecipanti</h2>
    ${renderParticipantsEditor(draft, () => {})}
  </div>`;
}

function setupStep2() {
  setupParticipantsEditor(draft, () => {});
}

// ── Step 3: Tema ──────────────────────────────────────────

function renderStep3() {
  const { primaryColor, accentColor, fontStyle } = draft.theme;
  const fonts = [
    { value: 'rounded', label: 'Arrotondato', sample: 'Aa', desc: 'Nunito — amichevole' },
    { value: 'classic',  label: 'Classico',    sample: 'Aa', desc: 'Georgia — formale'  },
    { value: 'bold',     label: 'Deciso',       sample: 'Aa', desc: 'Impact — dinamico'  },
  ];
  return `
    <div class="wizard-step">
      <h2 class="step-title">Tema grafico</h2>
      <div class="step-row">
        <div class="form-group">
          <label class="form-label">Colore primario</label>
          <div class="color-row">
            <input id="f-primary" type="color" class="color-picker" value="${primaryColor}">
            <span id="primary-hex" class="color-hex">${primaryColor}</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Colore accento</label>
          <div class="color-row">
            <input id="f-accent" type="color" class="color-picker" value="${accentColor}">
            <span id="accent-hex" class="color-hex">${accentColor}</span>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Stile font</label>
        <div class="font-options">
          ${fonts.map(f => `
            <label class="font-option ${fontStyle === f.value ? 'active' : ''}" data-font="${f.value}">
              <input type="radio" name="font-style" value="${f.value}" ${fontStyle === f.value ? 'checked' : ''}>
              <span class="font-sample font-${f.value}">${f.sample}</span>
              <strong>${f.label}</strong>
              <small>${f.desc}</small>
            </label>`).join('')}
        </div>
      </div>
      <div class="theme-preview" id="theme-preview">
        ${themePreviewHTML()}
      </div>
    </div>`;
}

function themePreviewHTML() {
  return `
    <div class="preview-label">Anteprima</div>
    <div class="preview-card" style="border-top-color: ${draft.theme.primaryColor}">
      <span>${draft.theme.emoji}</span>
      <strong style="color: ${draft.theme.primaryColor}">${draft.name || 'Nome Progetto'}</strong>
      <div class="preview-btn" style="background: ${draft.theme.primaryColor}">▶ Gioca</div>
    </div>`;
}

function setupStep3() {
  const updatePreview = () => {
    applyTheme(draft);
    document.getElementById('theme-preview').innerHTML = themePreviewHTML();
  };

  document.getElementById('f-primary').oninput = e => {
    draft.theme.primaryColor = e.target.value;
    document.getElementById('primary-hex').textContent = e.target.value;
    updatePreview();
  };
  document.getElementById('f-accent').oninput = e => {
    draft.theme.accentColor = e.target.value;
    document.getElementById('accent-hex').textContent = e.target.value;
    updatePreview();
  };
  document.querySelectorAll('input[name="font-style"]').forEach(r => {
    r.onchange = () => {
      draft.theme.fontStyle = r.value;
      document.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
      r.closest('.font-option').classList.add('active');
      updatePreview();
    };
  });
  applyTheme(draft);
}

// ── Step 4: Attività ──────────────────────────────────────

function renderStep4() {
  return `
    <div class="wizard-step">
      <div class="section-header">
        <h2 class="step-title">Attività</h2>
        <button id="btn-add-activity" class="btn btn-outline btn-sm">+ Aggiungi</button>
      </div>
      <div id="activities-list" class="activities-list">
        ${draftActivities.map(a => activityRowHTML(a)).join('')}
      </div>
    </div>`;
}

function activityRowHTML(a) {
  const pts   = a.points >= 0 ? `+${a.points}` : `${a.points}`;
  const color = a.points >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  const typeLabel = { standard: '', deadline: '⏰', recurring: '🔄' }[a.type] ?? '';
  return `
    <div class="activity-row ${a.active ? '' : 'inactive'}" data-id="${a.id}">
      <span class="activity-emoji">${escapeHtml(a.emoji)}</span>
      <span class="activity-name">${escapeHtml(a.name)}</span>
      <span class="activity-type-badge">${typeLabel}</span>
      <span class="activity-points" style="color:${color}">${pts}</span>
      <div class="activity-actions">
        <button class="btn btn-ghost btn-sm btn-toggle-activity" data-id="${a.id}" title="${a.active ? 'Disattiva' : 'Attiva'}">${a.active ? '✓' : '○'}</button>
        <button class="btn btn-ghost btn-sm btn-edit-activity"   data-id="${a.id}" title="Modifica">✏️</button>
        <button class="btn btn-ghost btn-sm btn-del-activity"    data-id="${a.id}" title="Elimina">🗑</button>
      </div>
    </div>`;
}

function setupStep4() {
  document.getElementById('btn-add-activity').onclick = () => openActivityModal(null);
  document.getElementById('activities-list').addEventListener('click', e => {
    const toggleBtn = e.target.closest('.btn-toggle-activity');
    const editBtn   = e.target.closest('.btn-edit-activity');
    const delBtn    = e.target.closest('.btn-del-activity');
    if (toggleBtn) {
      const act = draftActivities.find(a => a.id === toggleBtn.dataset.id);
      if (act) { act.active = !act.active; refreshActivitiesList(); }
    }
    if (editBtn) {
      const act = draftActivities.find(a => a.id === editBtn.dataset.id);
      if (act) openActivityModal(act);
    }
    if (delBtn) {
      draftActivities = draftActivities.filter(a => a.id !== delBtn.dataset.id);
      refreshActivitiesList();
    }
  });
}

function refreshActivitiesList() {
  document.getElementById('activities-list').innerHTML =
    draftActivities.map(a => activityRowHTML(a)).join('');
}

function openActivityModal(existing) {
  const a = existing ?? {
    id: generateId(), name: '', emoji: '⭐', points: 10, penaltyPoints: 0,
    type: 'standard', deadline: null, recurrence: null,
    lastCompleted: null, status: 'open', active: true, order: draftActivities.length,
    category: 'custom',
  };
  openModal(activityModalHTML(a), { onClose: null });
  setupActivityModal(a, existing !== null);
}

function activityModalHTML(a) {
  const dl = a.deadline ? new Date(a.deadline?.toDate?.() ?? a.deadline).toISOString().slice(0, 10) : '';
  return `
    <div class="modal-header">
      <h3 class="modal-title">${a.name ? 'Modifica attività' : 'Nuova attività'}</h3>
      <button class="modal-close btn" id="btn-modal-close">×</button>
    </div>
    <div class="step-row">
      <div class="form-group" style="flex:0 0 72px">
        <label class="form-label">Emoji</label>
        <input id="ma-emoji" class="form-input emoji-input" value="${escapeHtml(a.emoji)}" maxlength="2">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Nome *</label>
        <input id="ma-name" class="form-input" value="${escapeHtml(a.name)}" placeholder="Nome attività…">
      </div>
    </div>
    <div class="step-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Punti</label>
        <input id="ma-points" class="form-input" type="number" value="${a.points}">
        <span class="form-hint">Negativo = penalità diretta</span>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Tipo</label>
        <select id="ma-type" class="form-input">
          <option value="standard"  ${a.type==='standard'  ? 'selected' : ''}>Standard</option>
          <option value="deadline"  ${a.type==='deadline'  ? 'selected' : ''}>Con scadenza ⏰</option>
          <option value="recurring" ${a.type==='recurring' ? 'selected' : ''}>Ricorrente 🔄</option>
        </select>
      </div>
    </div>
    <div id="ma-deadline-row" class="form-group ${a.type!=='deadline' ? 'hidden' : ''}">
      <label class="form-label">Scadenza</label>
      <input id="ma-deadline" class="form-input" type="date" value="${dl}">
    </div>
    <div id="ma-recurrence-row" class="form-group ${a.type!=='recurring' ? 'hidden' : ''}">
      <label class="form-label">Ricorrenza</label>
      <select id="ma-recurrence" class="form-input">
        <option value="daily"   ${a.recurrence==='daily'   ? 'selected' : ''}>Giornaliera</option>
        <option value="weekly"  ${a.recurrence==='weekly'  ? 'selected' : ''}>Settimanale</option>
        <option value="monthly" ${a.recurrence==='monthly' ? 'selected' : ''}>Mensile</option>
      </select>
    </div>
    <div id="ma-penalty-row" class="form-group ${a.type==='standard' ? 'hidden' : ''}">
      <label class="form-label">Punti penalità (se non completato)</label>
      <input id="ma-penalty" class="form-input" type="number" value="${a.penaltyPoints ?? 0}">
      <span class="form-hint">Inserisci un valore negativo (es. −5)</span>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost"    id="btn-modal-cancel">Annulla</button>
      <button class="btn btn-primary"  id="btn-modal-confirm">Salva</button>
    </div>`;
}

function setupActivityModal(a, isEdit) {
  document.getElementById('btn-modal-close').onclick   = closeModal;
  document.getElementById('btn-modal-cancel').onclick  = closeModal;

  const typeSelect = document.getElementById('ma-type');
  typeSelect.onchange = () => {
    const t = typeSelect.value;
    document.getElementById('ma-deadline-row')  .classList.toggle('hidden', t !== 'deadline');
    document.getElementById('ma-recurrence-row').classList.toggle('hidden', t !== 'recurring');
    document.getElementById('ma-penalty-row')   .classList.toggle('hidden', t === 'standard');
  };

  document.getElementById('btn-modal-confirm').onclick = () => {
    const name = document.getElementById('ma-name').value.trim();
    if (!name) { document.getElementById('ma-name').focus(); return; }
    const type    = document.getElementById('ma-type').value;
    const dlVal   = document.getElementById('ma-deadline').value;
    Object.assign(a, {
      name,
      emoji:        document.getElementById('ma-emoji').value.trim() || '⭐',
      points:       parseInt(document.getElementById('ma-points').value) || 0,
      penaltyPoints:parseInt(document.getElementById('ma-penalty').value) || 0,
      type,
      deadline:     type === 'deadline'  && dlVal ? new Date(dlVal) : null,
      recurrence:   type === 'recurring' ? document.getElementById('ma-recurrence').value : null,
    });
    if (!isEdit) draftActivities.push(a);
    refreshActivitiesList();
    closeModal();
  };
}

// ── Step 5: Obiettivo + Evento + Badge + Danger zone ─────

function renderStep5() {
  const obj = draft.currentObjective;
  const ev  = draft.activeEvent;
  const partOptions = draft.participants
    .map(p => `<option value="${p.id}" ${obj?.targetParticipantId === p.id ? 'selected' : ''}>${escapeHtml(p.emoji)} ${escapeHtml(p.name)}</option>`)
    .join('');

  return `
    <div class="wizard-step">
      <h2 class="step-title">Obiettivo e Evento <span class="form-hint">(opzionali)</span></h2>

      <div class="collapsible-section">
        <label class="toggle-row">
          <input type="checkbox" id="enable-objective" ${obj ? 'checked' : ''}>
          <strong>🎯 Obiettivo</strong>
          <small>Un traguardo da raggiungere con premi</small>
        </label>
        <div id="objective-fields" class="${obj ? '' : 'hidden'}">
          <div class="form-group">
            <label class="form-label">Titolo obiettivo</label>
            <input id="f-obj-title" class="form-input" value="${escapeHtml(obj?.title ?? '')}" placeholder="es. Pizza Night!">
          </div>
          <div class="step-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Punti necessari</label>
              <input id="f-obj-pts" class="form-input" type="number" min="1" value="${obj?.targetPoints ?? 500}">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Per chi</label>
              <select id="f-obj-target" class="form-input"><option value="">Chiunque</option>${partOptions}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Premio</label>
            <input id="f-obj-reward" class="form-input" value="${escapeHtml(obj?.rewardDescription ?? '')}" placeholder="es. Ordiniamo la pizza!">
          </div>
        </div>
      </div>

      <div class="collapsible-section">
        <label class="toggle-row">
          <input type="checkbox" id="enable-event" ${ev ? 'checked' : ''}>
          <strong>🎉 Evento speciale</strong>
          <small>Giornata o settimana con punti moltiplicati</small>
        </label>
        <div id="event-fields" class="${ev ? '' : 'hidden'}">
          <div class="step-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Titolo evento</label>
              <input id="f-ev-title" class="form-input" value="${escapeHtml(ev?.title ?? '')}" placeholder="es. Weekend Bonus">
            </div>
            <div class="form-group" style="flex:0 0 80px">
              <label class="form-label">Emoji</label>
              <input id="f-ev-emoji" class="form-input emoji-input" value="${escapeHtml(ev?.emoji ?? '🎉')}" maxlength="2">
            </div>
          </div>
          <div class="step-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Moltiplicatore</label>
              <select id="f-ev-mult" class="form-input">
                ${[2,3,5].map(x => `<option value="${x}" ${(ev?.multiplier??2)===x?'selected':''}>${x}× punti</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Dal</label>
              <input id="f-ev-start" class="form-input" type="date" value="${ev?.startDate ? new Date(ev.startDate?.toDate?.()??ev.startDate).toISOString().slice(0,10) : ''}">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Al</label>
              <input id="f-ev-end" class="form-input" type="date" value="${ev?.endDate ? new Date(ev.endDate?.toDate?.()??ev.endDate).toISOString().slice(0,10) : ''}">
            </div>
          </div>
        </div>
      </div>

      <div class="collapsible-section">
        <label class="toggle-row">
          <input type="checkbox" id="enable-badges" checked>
          <strong>🏅 Badge</strong>
          <small>Riconoscimenti sbloccati automaticamente</small>
        </label>
        <div id="badges-fields">
          <div id="badges-list" class="badges-list">
            ${draftBadges.map(b => badgeRowHTML(b)).join('')}
          </div>
          <button id="btn-add-badge" class="btn btn-outline btn-sm" style="margin-top:var(--space-sm)">+ Aggiungi badge</button>
        </div>
      </div>

      ${editingId ? `
      <div class="danger-zone">
        <h3 class="danger-zone-title">⚠️ Zona pericolo</h3>
        <p class="form-hint">Queste azioni sono irreversibili.</p>
        <div class="danger-zone-actions">
          <button id="btn-reset-scores" class="btn btn-danger btn-sm">🔄 Reset punteggi</button>
        </div>
      </div>` : ''}
    </div>`;
}

function setupStep5() {
  document.getElementById('enable-objective').onchange = e =>
    document.getElementById('objective-fields').classList.toggle('hidden', !e.target.checked);
  document.getElementById('enable-event').onchange = e =>
    document.getElementById('event-fields').classList.toggle('hidden', !e.target.checked);

  // Badge CRUD
  document.getElementById('btn-add-badge')?.addEventListener('click', () => openBadgeModal(null));
  document.getElementById('badges-list')?.addEventListener('click', e => {
    const del = e.target.closest('.btn-del-badge');
    if (del) {
      draftBadges = draftBadges.filter(b => b.id !== del.dataset.id);
      document.getElementById('badges-list').innerHTML = draftBadges.map(b => badgeRowHTML(b)).join('');
    }
  });

  // Reset punteggi
  document.getElementById('btn-reset-scores')?.addEventListener('click', async () => {
    openModal(`
      <div class="modal-header"><h3 class="modal-title">Reset punteggi</h3>
        <button class="modal-close btn" id="ml-close">×</button></div>
      <p style="margin:var(--space-md) 0">Tutti i punteggi torneranno a <strong>0</strong>. Lo storico rimane invariato. Continuare?</p>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="ml-cancel">Annulla</button>
        <button class="btn btn-danger" id="ml-confirm">Reset</button>
      </div>`);
    document.getElementById('ml-close').onclick   = closeModal;
    document.getElementById('ml-cancel').onclick  = closeModal;
    document.getElementById('ml-confirm').onclick = async () => {
      closeModal();
      try {
        await resetScores(editingId, draft.participants);
        showToast('Punteggi azzerati!');
      } catch (e) {
        showToast('Errore nel reset.', 'error');
      }
    };
  });
}

function badgeRowHTML(b) {
  const condLabel = {
    log_count:    `Dopo ${b.condition?.threshold ?? '?'} log`,
    points_total: `Dopo ${b.condition?.threshold ?? '?'} punti`,
    streak_days:  `Dopo ${b.condition?.threshold ?? '?'} giorni di fila`,
  }[b.condition?.type] ?? '';
  return `
    <div class="badge-row" data-id="${b.id}">
      <span class="br-emoji">${escapeHtml(b.emoji)}</span>
      <div class="br-info">
        <span class="br-name">${escapeHtml(b.name)}</span>
        <span class="br-cond">${condLabel}</span>
      </div>
      <button class="btn btn-ghost btn-sm btn-del-badge" data-id="${b.id}">🗑</button>
    </div>`;
}

function openBadgeModal(existing) {
  const b = existing ?? { id: generateId(), name: '', emoji: '🏅', description: '', condition: { type: 'log_count', threshold: 10 } };
  openModal(`
    <div class="modal-header">
      <h3 class="modal-title">Nuovo badge</h3>
      <button class="modal-close btn" id="ml-close">×</button>
    </div>
    <div class="step-row">
      <div class="form-group" style="flex:0 0 72px">
        <label class="form-label">Emoji</label>
        <input id="mb-emoji" class="form-input emoji-input" value="${escapeHtml(b.emoji)}" maxlength="2">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Nome *</label>
        <input id="mb-name" class="form-input" value="${escapeHtml(b.name)}" placeholder="es. Campione">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descrizione</label>
      <input id="mb-desc" class="form-input" value="${escapeHtml(b.description)}" placeholder="es. Raggiungi 500 punti">
    </div>
    <div class="step-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Condizione</label>
        <select id="mb-type" class="form-input">
          <option value="log_count"    ${b.condition.type==='log_count'    ?'selected':''}>Numero di log</option>
          <option value="points_total" ${b.condition.type==='points_total' ?'selected':''}>Punti totali</option>
          <option value="streak_days"  ${b.condition.type==='streak_days'  ?'selected':''}>Giorni consecutivi</option>
        </select>
      </div>
      <div class="form-group" style="flex:0 0 100px">
        <label class="form-label">Soglia</label>
        <input id="mb-threshold" class="form-input" type="number" min="1" value="${b.condition.threshold ?? 10}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="ml-cancel">Annulla</button>
      <button class="btn btn-primary" id="ml-confirm">Aggiungi</button>
    </div>`);
  document.getElementById('ml-close').onclick  = closeModal;
  document.getElementById('ml-cancel').onclick = closeModal;
  document.getElementById('ml-confirm').onclick = () => {
    const name = document.getElementById('mb-name').value.trim();
    if (!name) { document.getElementById('mb-name').focus(); return; }
    Object.assign(b, {
      name,
      emoji:       document.getElementById('mb-emoji').value.trim() || '🏅',
      description: document.getElementById('mb-desc').value.trim(),
      condition: {
        type:      document.getElementById('mb-type').value,
        threshold: parseInt(document.getElementById('mb-threshold').value) || 10,
      },
    });
    if (!existing) draftBadges.push(b);
    document.getElementById('badges-list').innerHTML = draftBadges.map(b => badgeRowHTML(b)).join('');
    closeModal();
  };
}

// ── Dispatcher setup ──────────────────────────────────────

function setupStep(step) {
  const fns = [null, setupStep1, setupStep2, setupStep3, setupStep4, setupStep5];
  fns[step]?.();
}

// ── Salva su Firestore ────────────────────────────────────

async function saveProject() {
  const btn = document.getElementById('btn-editor-save');
  btn.disabled = true;
  btn.textContent = 'Salvataggio…';

  // Leggi step 5 (obiettivo + evento)
  readStep5IntoDraft();

  const user = getCurrentUser();
  const projectData = {
    ownerUid: user.uid, ownerEmail: user.email,
    name: draft.name.trim(),
    description: draft.description.trim(),
    theme: { ...draft.theme },
    participantMode: draft.participantMode,
    participants: draft.participants,
    currentObjective: draft.currentObjective ?? null,
    activeEvent: draft.activeEvent ?? null,
    settings: draft.settings,
  };

  try {
    if (editingId) {
      await updateProject(editingId, projectData);
      await Promise.all([
        ...draftActivities.map((a, i) => saveActivity(editingId, a.id, { ...a, order: i })),
        ...draftBadges.map(b => saveBadge(editingId, b.id, { name: b.name, emoji: b.emoji, description: b.description, condition: b.condition })),
      ]);
      showToast('Progetto aggiornato!');
    } else {
      const ref = await createProject(projectData);
      await initScores(ref.id, draft.participants);
      await Promise.all([
        ...draftActivities.map((a, i) => saveActivity(ref.id, a.id, { ...a, order: i })),
        ...draftBadges.map(b => saveBadge(ref.id, b.id, { name: b.name, emoji: b.emoji, description: b.description, condition: b.condition })),
      ]);
    }
    navigate('/dashboard');
  } catch (err) {
    console.error(err);
    showToast('Errore nel salvataggio. Riprova.', 'error');
    btn.disabled = false;
    btn.textContent = '✓ Pubblica';
  }
}

function readStep5IntoDraft() {
  const objEnabled = document.getElementById('enable-objective')?.checked;
  const evEnabled  = document.getElementById('enable-event')?.checked;

  draft.currentObjective = objEnabled ? {
    title:              document.getElementById('f-obj-title')?.value.trim()   ?? '',
    targetPoints:       parseInt(document.getElementById('f-obj-pts')?.value)  ?? 500,
    targetParticipantId:document.getElementById('f-obj-target')?.value         ?? '',
    rewardDescription:  document.getElementById('f-obj-reward')?.value.trim()  ?? '',
  } : null;

  draft.activeEvent = evEnabled ? {
    title:      document.getElementById('f-ev-title')?.value.trim()   ?? '',
    emoji:      document.getElementById('f-ev-emoji')?.value.trim()   ?? '🎉',
    multiplier: parseInt(document.getElementById('f-ev-mult')?.value) ?? 2,
    startDate:  document.getElementById('f-ev-start')?.value ? new Date(document.getElementById('f-ev-start').value) : null,
    endDate:    document.getElementById('f-ev-end')?.value   ? new Date(document.getElementById('f-ev-end').value)   : null,
  } : null;
}

// ── Carica progetto esistente ─────────────────────────────

async function loadExistingProject(projectId) {
  return new Promise(resolve => {
    const unsub = subscribeProject(projectId, project => {
      unsub();
      const actUnsub = subscribeActivities(projectId, activities => {
        actUnsub();
        draftActivities = activities;
        // Carica anche i badge
        getDocs(collection(db, 'projects', projectId, 'badges'))
          .then(snap => {
            draftBadges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            resolve(normalizeDraft(project));
          })
          .catch(() => { draftBadges = []; resolve(normalizeDraft(project)); });
      });
    });
  });
}

// ── Draft vuoto ───────────────────────────────────────────

function createEmptyDraft() {
  return {
    name: '', description: '',
    theme: { emoji: '🎯', primaryColor: '#6C63FF', accentColor: '#FF6584', fontStyle: 'rounded' },
    participantMode: 'teams',
    participants: [
      { id: generateId(), name: 'Squadra A', emoji: '🔵' },
      { id: generateId(), name: 'Squadra B', emoji: '🔴' },
    ],
    settings: { allowSelfLog: true, showLogHistory: true },
    currentObjective: null,
    activeEvent: null,
  };
}

function normalizeDraft(project) {
  // Garantisce che tutti i campi attesi esistano, anche per progetti vecchi
  return {
    ...project,
    name:            project.name            ?? '',
    description:     project.description     ?? '',
    theme:           project.theme           ?? { emoji: '🎯', primaryColor: '#6C63FF', accentColor: '#FF6584', fontStyle: 'rounded' },
    participantMode: project.participantMode  ?? 'teams',
    participants:    Array.isArray(project.participants) ? project.participants : [],
    settings:        project.settings        ?? { allowSelfLog: true, showLogHistory: true },
    currentObjective:project.currentObjective ?? null,
    activeEvent:     project.activeEvent     ?? null,
  };
}
