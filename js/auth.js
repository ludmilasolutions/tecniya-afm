import { store } from './store.js';
import { getSupabase, onAuthStateChange } from './supabase.js';
import { showToast, updateAuthUI, showPage, closeModal, showModal } from './ui.js';

export async function initAuth() {
  const sb = getSupabase();
  if (!sb) return;
  
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await handleSession(session);
    }
    
    sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await handleSession(session);
      } else {
        handleLogout();
      }
    });
  } catch (e) {
    console.log('Supabase init:', e.message);
  }
}

export async function handleSession(session) {
  const sb = getSupabase();
  store.setCurrentUser(session.user);
  
  const { data: prof } = await sb.from('professionals').select('*').eq('user_id', session.user.id).maybeSingle();
  store.setCurrentPro(prof);
  
  const meta = session.user.user_metadata || {};
  store.setCurrentRole(meta.role || (prof ? 'professional' : 'user'));
  
  updateAuthUI();
  
  const { setupNotifBadge } = await import('./notifications.js');
  setupNotifBadge();
}

export function handleLogout() {
  store.reset();
  updateAuthUI();
}

export async function loginEmail() {
  const sb = getSupabase();
  const email = document.getElementById('login-email')?.value.trim();
  const pass = document.getElementById('login-pass')?.value;
  const errEl = document.getElementById('login-error');
  
  if (!email || !pass) {
    if (errEl) {
      errEl.textContent = 'Completá todos los campos.';
      errEl.classList.remove('hidden');
    }
    return;
  }
  
  const btn = document.getElementById('btn-login');
  if (btn) {
    btn.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;"></div> Ingresando...';
    btn.disabled = true;
  }
  
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  
  if (btn) {
    btn.innerHTML = 'Ingresar';
    btn.disabled = false;
  }
  
  if (error) {
    if (errEl) {
      errEl.textContent = error.message;
      errEl.classList.remove('hidden');
    }
  } else {
    closeModal('modal-login');
    showToast('¡Bienvenido!', 'success');
    redirectAfterLogin();
  }
}

export async function registerEmail() {
  const sb = getSupabase();
  const name = document.getElementById('reg-name')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const pass = document.getElementById('reg-pass')?.value;
  const role = document.getElementById('reg-role')?.value;
  const errEl = document.getElementById('reg-error');
  
  if (!name || !email || !pass) {
    if (errEl) {
      errEl.textContent = 'Completá todos los campos.';
      errEl.classList.remove('hidden');
    }
    return;
  }
  
  const btn = document.getElementById('btn-register');
  if (btn) {
    btn.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;"></div> Creando cuenta...';
    btn.disabled = true;
  }
  
  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: {
      data: { full_name: name, role }
    }
  });
  
  if (btn) {
    btn.innerHTML = 'Crear cuenta';
    btn.disabled = false;
  }
  
  if (error) {
    if (errEl) {
      errEl.textContent = error.message;
      errEl.classList.remove('hidden');
    }
    return;
  }
  
  if (data.user && role === 'professional') {
    await sb.from('professionals').insert({
      user_id: data.user.id,
      specialty: 'General',
      city: '',
      province: '',
      description: ''
    });
  }
  
  closeModal('modal-register');
  showToast('¡Cuenta creada! Revisá tu email para verificar.', 'success');
}

export async function loginGoogle() {
  const sb = getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) {
    showToast(error.message, 'error');
  }
}

export async function logout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  
  const userDropdown = document.getElementById('user-dropdown');
  if (userDropdown) {
    userDropdown.style.display = 'none';
  }
  
  showPage('home');
  showToast('Sesión cerrada', 'info');
}

export function redirectAfterLogin() {
  if (store.currentRole === 'admin') {
    showPage('admin');
  } else if (store.currentRole === 'professional') {
    showPage('pro-dashboard');
  } else {
    showPage('user-dashboard');
  }
}

export function initAuthEventListeners() {
  const loginEmailBtn = document.getElementById('btn-login');
  if (loginEmailBtn) loginEmailBtn.addEventListener('click', loginEmail);
  
  const registerEmailBtn = document.getElementById('btn-register');
  if (registerEmailBtn) registerEmailBtn.addEventListener('click', registerEmail);
  
  const loginPassInput = document.getElementById('login-pass');
  if (loginPassInput) {
    loginPassInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') loginEmail();
    });
  }

  const googleLoginBtn = document.getElementById('btn-google-login');
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', loginGoogle);

  const googleRegisterBtn = document.getElementById('btn-google-register');
  if (googleRegisterBtn) googleRegisterBtn.addEventListener('click', loginGoogle);

  const logoutBtn = document.getElementById('menu-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', e => { e.preventDefault(); logout(); });

  const navLoginBtn = document.getElementById('btn-login-nav');
  if (navLoginBtn) navLoginBtn.addEventListener('click', () => showModal('modal-login'));

  const navRegisterBtn = document.getElementById('btn-register-nav');
  if (navRegisterBtn) navRegisterBtn.addEventListener('click', () => showModal('modal-register'));

  const mobileLoginLink = document.getElementById('mobile-login-link');
  if (mobileLoginLink) mobileLoginLink.addEventListener('click', e => { e.preventDefault(); showModal('modal-login'); });
}
