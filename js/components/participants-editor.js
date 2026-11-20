import { escapeHtml, generateId } from '../utils.js';

const EMOJI_SUGGESTIONS = ['🔵','🔴','🟢','🟡','🟠','🟣','⚫','⚪','🐯','🦁','🦊','🐺','🦋','🐸','🦄','🐲'];

export function renderParticipantsEditor(draft, onChange) {
  return `
    <div class="participants-editor">
      <div class="mode-toggle">
        <label class="mode-option ${draft.participantMode === 'teams' ? 'active' : ''}">
          <input type="radio" name="part-mode" value="teams" ${draft.participantMode === 'teams' ? 'checked' : ''}>
          <span class="mode-icon">🏆</span>
          <strong>Squadre</strong>
          <small>Giocano insieme per squadra</small>
        </label>
        <label class="mode-option ${draft.participantMode === 'individuals' ? 'active' : ''}">
          <input type="radio" name="part-mode" value="individuals" ${draft.participantMode === 'individuals' ? 'checked' : ''}>
          <span class="mode-icon">🧑</span>
          <strong>Individuale</strong>
          <small>Classifica personale</small>
        </label>
      </div>

      <div class="participants-list" id="participants-list">
        ${draft.participants.map((p, i) => participantRowHTML(p, i)).join('')}
      </div>

      <div class="add-participant-form" id="add-participant-form">
        <input id="new-part-emoji" class="form-input emoji-input" value="🔵" maxlength="2" placeholder="🔵">
        <input id="new-part-name"  class="form-input" placeholder="${draft.participantMode === 'individuals' ? 'Nome persona…' : 'Nome squadra…'}">
        <button id="btn-add-participant" class="btn btn-outline btn-sm">+ Aggiungi</button>
      </div>
      <p class="form-hint">Minimo 2 partecipanti, massimo 8.</p>
    </div>`;
}

export function setupParticipantsEditor(draft, onChange) {
  // Mode toggle
  document.querySelectorAll('input[name="part-mode"]').forEach(radio => {
    radio.onchange = () => {
      draft.participantMode = radio.value;
      document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
      radio.closest('.mode-option').classList.add('active');
      const placeholder = draft.participantMode === 'individuals' ? 'Nome persona…' : 'Nome squadra…';
      document.getElementById('new-part-name').placeholder = placeholder;
      onChange(draft);
    };
  });

  // Remove participants
  document.getElementById('participants-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-participant');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index);
    if (draft.participants.length <= 2) return;
    draft.participants.splice(idx, 1);
    document.getElementById('participants-list').innerHTML =
      draft.participants.map((p, i) => participantRowHTML(p, i)).join('');
    rebindRemove(draft, onChange);
    onChange(draft);
  });

  // Add participant
  document.getElementById('btn-add-participant').onclick = () => {
    if (draft.participants.length >= 8) return;
    const emoji = document.getElementById('new-part-emoji').value.trim() || '🔵';
    const name  = document.getElementById('new-part-name').value.trim();
    if (!name) { document.getElementById('new-part-name').focus(); return; }
    draft.participants.push({ id: generateId(), name, emoji });
    document.getElementById('participants-list').innerHTML =
      draft.participants.map((p, i) => participantRowHTML(p, i)).join('');
    rebindRemove(draft, onChange);
    document.getElementById('new-part-name').value  = '';
    document.getElementById('new-part-emoji').value = EMOJI_SUGGESTIONS[draft.participants.length % EMOJI_SUGGESTIONS.length];
    onChange(draft);
  };
}

function rebindRemove(draft, onChange) {
  document.getElementById('participants-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-participant');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index);
    if (draft.participants.length <= 2) return;
    draft.participants.splice(idx, 1);
    document.getElementById('participants-list').innerHTML =
      draft.participants.map((p, i) => participantRowHTML(p, i)).join('');
    onChange(draft);
  }, { once: true });
}

function participantRowHTML(p, i) {
  return `
    <div class="participant-row">
      <span class="participant-emoji">${escapeHtml(p.emoji)}</span>
      <span class="participant-name">${escapeHtml(p.name)}</span>
      <button class="btn btn-ghost btn-sm btn-remove-participant" data-index="${i}" title="Rimuovi">×</button>
    </div>`;
}
