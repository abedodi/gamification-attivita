import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut          as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

let _auth = null;
let _currentUser = null;
let _resolveReady;

// Risolve quando Firebase ha verificato la sessione persistita (max ~500ms)
export const authReady = new Promise(resolve => { _resolveReady = resolve; });

export function initAuth(app) {
  _auth = getAuth(app);
  fbOnAuthStateChanged(_auth, user => {
    _currentUser = user;
    _resolveReady(user);
  });
}

export function getCurrentUser()  { return _currentUser; }
export function isLoggedIn()      { return _currentUser !== null; }

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(_auth, provider);
  _currentUser = result.user;
  return result.user;
}

export async function signOut() {
  await fbSignOut(_auth);
  _currentUser = null;
}

// Callback chiamata ogni volta che cambia lo stato auth (login/logout)
export function onAuthChange(cb) {
  if (!_auth) return () => {};
  return fbOnAuthStateChanged(_auth, user => {
    _currentUser = user;
    cb(user);
  });
}
