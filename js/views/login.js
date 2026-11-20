import { signInWithGoogle, getCurrentUser } from '../auth.js';
import { navigate }                          from '../router.js';

export function mount() {
  if (getCurrentUser()) {
    navigate('/dashboard');
    return;
  }

  const btn = document.getElementById('btn-google-login');
  const errorEl = document.querySelector('.login-error');

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Accesso in corso…';
    if (errorEl) errorEl.textContent = '';
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Accedi con Google';
      if (errorEl) errorEl.textContent = 'Accesso non riuscito. Riprova.';
      console.error('Auth error:', err);
    }
  };
}
