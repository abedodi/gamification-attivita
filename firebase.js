import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore, collection, doc,
         getDoc, setDoc, updateDoc, deleteDoc,
         addDoc, getDocs, query, where,
         orderBy, limit, startAfter,
         onSnapshot, writeBatch,
         increment, serverTimestamp }            from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { firebaseConfig }                        from '../firebase-config.js';
import { initAuth }                              from './auth.js';

// ── Init ──────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
initAuth(app);

// ── Re-export Firestore helpers usati dai componenti ──────
export { collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
         addDoc, getDocs, query, where, orderBy, limit, startAfter,
         onSnapshot, writeBatch, increment, serverTimestamp };

// ── Badge starter ─────────────────────────────────────────
export const STARTER_BADGES = [
  { name: 'Primo Passo',  emoji: '👣', description: 'Registra la tua prima attività!',   condition: { type: 'log_count',    threshold: 1   } },
  { name: 'Instancabile', emoji: '💪', description: 'Registra 10 attività in totale.',    condition: { type: 'log_count',    threshold: 10  } },
  { name: 'Centurione',   emoji: '🏅', description: 'Raggiungi 100 punti.',               condition: { type: 'points_total', threshold: 100 } },
  { name: 'Campione',     emoji: '🏆', description: 'Raggiungi 500 punti.',               condition: { type: 'points_total', threshold: 500 } },
  { name: 'Costanza',     emoji: '📆', description: 'Registra attività per 3 giorni di fila.', condition: { type: 'streak_days', threshold: 3 } },
];

export async function seedBadgesIfEmpty(projectId) {
  const ref  = collection(db, 'projects', projectId, 'badges');
  const snap = await getDocs(query(ref, limit(1)));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  STARTER_BADGES.forEach(b => batch.set(doc(ref), b));
  await batch.commit();
}

// ── Attività starter (seed per ogni nuovo progetto) ───────
export const STARTER_ACTIVITIES = [
  { name: 'Apparecchiare',                emoji: '🍽️',  points: 10,  penaltyPoints: 0,   category: 'chores',   type: 'standard' },
  { name: 'Sparecchiare',                 emoji: '🧹',  points: 10,  penaltyPoints: 0,   category: 'chores',   type: 'standard' },
  { name: 'Rifare il letto',              emoji: '🛏️',  points: 15,  penaltyPoints: 0,   category: 'chores',   type: 'standard' },
  { name: 'Compiti',                      emoji: '📚',  points: 20,  penaltyPoints: 0,   category: 'homework', type: 'standard' },
  { name: 'Mettere in ordine la camera',  emoji: '🧸',  points: 15,  penaltyPoints: 0,   category: 'chores',   type: 'standard' },
  { name: 'Aiutare in cucina',            emoji: '👨‍🍳', points: 10,  penaltyPoints: 0,   category: 'chores',   type: 'standard' },
  { name: 'Capricci',                     emoji: '😤',  points: -10, penaltyPoints: 0,   category: 'penalty',  type: 'standard' },
  { name: 'Alzare la voce',               emoji: '📢',  points: -10, penaltyPoints: 0,   category: 'penalty',  type: 'standard' },
  { name: 'Non fare i compiti',           emoji: '📖',  points: -15, penaltyPoints: 0,   category: 'penalty',  type: 'standard' },
  { name: 'Aiutare un fratello/sorella',  emoji: '🤝',  points: 10,  penaltyPoints: 0,   category: 'chores',   type: 'standard' },
];

// ── Seed progetto al primo avvio ──────────────────────────
export async function seedProjectIfEmpty(projectId) {
  const activitiesRef = collection(db, 'projects', projectId, 'activities');
  const snap = await getDocs(query(activitiesRef, limit(1)));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  STARTER_ACTIVITIES.forEach((act, i) => {
    const ref = doc(activitiesRef);
    batch.set(ref, { ...act, active: true, order: i, deadline: null, recurrence: null, lastCompleted: null, status: 'open' });
  });
  await batch.commit();
}

// ── Progetti ──────────────────────────────────────────────
export function subscribeUserProjects(uid, cb) {
  const q = query(collection(db, 'projects'), where('ownerUid', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function subscribeProject(projectId, cb) {
  return onSnapshot(doc(db, 'projects', projectId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() });
    else cb(null);
  });
}

export async function createProject(data) {
  return addDoc(collection(db, 'projects'), { ...data, createdAt: serverTimestamp() });
}

export async function updateProject(projectId, data) {
  return updateDoc(doc(db, 'projects', projectId), data);
}

export async function deleteProject(projectId) {
  return deleteDoc(doc(db, 'projects', projectId));
}

// ── Punteggi ──────────────────────────────────────────────
export function subscribeScores(projectId, cb) {
  return onSnapshot(collection(db, 'projects', projectId, 'scores'), snap => {
    const scores = {};
    snap.forEach(d => { scores[d.id] = d.data().points ?? 0; });
    cb(scores);
  });
}

export async function initScores(projectId, participants) {
  const batch = writeBatch(db);
  participants.forEach(p => {
    batch.set(doc(db, 'projects', projectId, 'scores', p.id), { participantId: p.id, points: 0, lastUpdated: serverTimestamp() });
  });
  return batch.commit();
}

// ── Attività ──────────────────────────────────────────────
export function subscribeActivities(projectId, cb) {
  const q = query(collection(db, 'projects', projectId, 'activities'), orderBy('order'));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function saveActivity(projectId, activityId, data) {
  const ref = activityId
    ? doc(db, 'projects', projectId, 'activities', activityId)
    : doc(collection(db, 'projects', projectId, 'activities'));
  return setDoc(ref, data, { merge: true });
}

export async function deleteActivity(projectId, activityId) {
  return deleteDoc(doc(db, 'projects', projectId, 'activities', activityId));
}

// ── Log ───────────────────────────────────────────────────
export async function logActivity({ projectId, participantId, participantName, activity, multiplier = 1, type = 'completion', note = '', loggedBy = 'anonymous' }) {
  const basePoints  = type === 'penalty' ? (activity.penaltyPoints ?? 0) : activity.points;
  const finalPoints = type === 'penalty' ? basePoints : basePoints * multiplier;
  const batch = writeBatch(db);

  const scoresRef = doc(db, 'projects', projectId, 'scores', participantId);
  batch.update(scoresRef, { points: increment(finalPoints), lastUpdated: serverTimestamp() });

  const logRef = doc(collection(db, 'projects', projectId, 'log'));
  batch.set(logRef, {
    participantId, participantName,
    activityId: activity.id, activityName: activity.name, activityEmoji: activity.emoji,
    basePoints, multiplier, finalPoints,
    type, note, loggedBy,
    timestamp: serverTimestamp(),
  });

  if (activity.type === 'recurring' && type === 'completion') {
    const actRef = doc(db, 'projects', projectId, 'activities', activity.id);
    batch.update(actRef, { lastCompleted: serverTimestamp() });
  }
  if (activity.type === 'deadline' && type === 'completion') {
    const actRef = doc(db, 'projects', projectId, 'activities', activity.id);
    batch.update(actRef, { status: 'done' });
  }

  return batch.commit();
}

export async function deleteLogEntry(projectId, logEntry) {
  const batch = writeBatch(db);
  // Elimina la voce
  batch.delete(doc(db, 'projects', projectId, 'log', logEntry.id));
  // Storna i punti
  batch.update(
    doc(db, 'projects', projectId, 'scores', logEntry.participantId),
    { points: increment(-logEntry.finalPoints), lastUpdated: serverTimestamp() }
  );
  return batch.commit();
}

export function subscribeLog(projectId, cb, pageSize = 20) {
  const q = query(collection(db, 'projects', projectId, 'log'), orderBy('timestamp', 'desc'), limit(pageSize));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// ── Reset punteggi ────────────────────────────────────────
export async function resetScores(projectId, participants) {
  const batch = writeBatch(db);
  participants.forEach(p => {
    batch.update(doc(db, 'projects', projectId, 'scores', p.id),
      { points: 0, lastUpdated: serverTimestamp() });
  });
  return batch.commit();
}

// ── Badge ─────────────────────────────────────────────────
export function subscribeBadges(projectId, cb) {
  return onSnapshot(collection(db, 'projects', projectId, 'badges'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export function subscribeAwardedBadges(projectId, cb) {
  return onSnapshot(collection(db, 'projects', projectId, 'awardedBadges'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function saveBadge(projectId, badgeId, data) {
  const ref = badgeId
    ? doc(db, 'projects', projectId, 'badges', badgeId)
    : doc(collection(db, 'projects', projectId, 'badges'));
  return setDoc(ref, data, { merge: true });
}

export async function deleteBadgeDoc(projectId, badgeId) {
  return deleteDoc(doc(db, 'projects', projectId, 'badges', badgeId));
}

export async function awardBadge(projectId, participantId, badge) {
  const existing = await getDocs(query(
    collection(db, 'projects', projectId, 'awardedBadges'),
    where('badgeId', '==', badge.id),
    where('participantId', '==', participantId),
    limit(1)
  ));
  if (!existing.empty) return false;
  await addDoc(collection(db, 'projects', projectId, 'awardedBadges'), {
    participantId, badgeId: badge.id, badgeName: badge.name, badgeEmoji: badge.emoji,
    awardedAt: serverTimestamp(),
  });
  return true;
}

// ── Utenti ────────────────────────────────────────────────
export async function saveUser(uid, data) {
  return setDoc(doc(db, 'users', uid), data, { merge: true });
}
