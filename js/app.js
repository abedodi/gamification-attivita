import './firebase.js'; // inizializza Firebase + Auth come side effect
import { onRouteChange, mountView, navigate } from './router.js';
import { authReady, getCurrentUser, onAuthChange } from './auth.js';

const PROTECTED = ['dashboard', 'editor'];
const viewCache = {};

async function loadAndMount(viewName, params) {
  mountView(viewName);
  if (!viewCache[viewName]) {
    try {
      viewCache[viewName] = await import(`./views/${viewName}.js`);
    } catch {
      // view non ancora implementata — mostrata vuota
    }
  }
  viewCache[viewName]?.mount?.(params);
}

async function handleRoute({ view, params }) {
  await authReady;
  const user = getCurrentUser();

  if (PROTECTED.includes(view) && !user) { navigate('/');          return; }
  if (view === 'login'          &&  user) { navigate('/dashboard'); return; }

  loadAndMount(view, params);
}

onRouteChange(handleRoute);

// Reindirizza se l'utente fa logout mentre è su una pagina protetta
onAuthChange(user => {
  if (!user) {
    const hash = window.location.hash.replace(/^#/, '');
    if (PROTECTED.some(v => hash.startsWith(`/${v}`))) navigate('/');
  }
});
