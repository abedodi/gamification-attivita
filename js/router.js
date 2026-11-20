const VIEWS = {
  login:     document.getElementById('view-login'),
  dashboard: document.getElementById('view-dashboard'),
  editor:    document.getElementById('view-editor'),
  play:      document.getElementById('view-play'),
};

let _onUnmount = null;

export function navigate(hash) {
  window.location.hash = hash;
}

export function onRouteChange(handler) {
  const fire = () => handler(parseRoute());
  window.addEventListener('hashchange', fire);
  fire(); // esegui subito per la route iniziale
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  if (hash === '/' || hash === '') return { view: 'login', params: {} };
  if (hash === '/dashboard')           return { view: 'dashboard', params: {} };
  if (hash.startsWith('/edit/'))       return { view: 'editor', params: { projectId: hash.slice('/edit/'.length) } };
  if (hash.startsWith('/play/'))       return { view: 'play',   params: { projectId: hash.slice('/play/'.length) } };
  return { view: 'login', params: {} };
}

export function mountView(viewName) {
  if (_onUnmount) { _onUnmount(); _onUnmount = null; }
  Object.values(VIEWS).forEach(el => el?.classList.add('hidden'));
  VIEWS[viewName]?.classList.remove('hidden');
}

export function registerUnmount(fn) {
  _onUnmount = fn;
}
