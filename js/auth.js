import { store } from './store.js';
import { getSupabase, onAuthStateChange } from './supabase.js';
import { showToast, updateAuthUI, showPage, closeModal, showModal } from './ui.js';

export async function initAuth() {
  const sb = getSupabase();
  if (!sb) return;
  
  let sessionHandled = false;

  try {
    // Si la URL tiene un hash de OAuth (Google login), procesarlo primero
    if (window.location.hash && window.location.hash.includes('access_token')) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        sessionHandled = true;
        await handleSession(session);
        window.history.replaceState(null, '', window.location.pathname);
        await redirectAfterLogin();
      }
    } else {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        sessionHandled = true;
        await handleSession(session);
        await redirectAfterLogin();
      }
    }
    
    sb.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, sessionHandled);
      if (event === 'SIGNED_IN' && session) {
        if (sessionHandled) { sessionHandled = false; return; } // evitar doble llamada
        await handleSession(session);
        window.history.replaceState(null, '', window.location.pathname);
        await redirectAfterLogin();
      } else if (event === 'SIGNED_OUT') {
        sessionHandled = false;
        handleLogout();
      }
    });
  } catch (e) {
    console.log('Supabase init error:', e.message);
  }
}

export async function handleSession(session) {
  const sb = getSupabase();
  store.setCurrentUser(session.user);

  // Leer role desde profiles (fuente de verdad)
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  // Buscar registro profesional
  const { data: prof } = await sb
    .from('professionals')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  store.setCurrentPro(prof);

  // Role: primero profiles, luego user_metadata, luego inferir
  const meta = session.user.user_metadata || {};
  let role = profile?.role || meta.role || (prof ? 'professional' : 'user');
  store.setCurrentRole(role);

  // Si eligió professional pero profiles aún dice 'user', sincronizar
  if (meta.role === 'professional' && profile?.role !== 'professional') {
    await sb.from('profiles').update({ role: 'professional' }).eq('id', session.user.id);
    store.setCurrentRole('professional');
    // Crear registro en professionals si no existe
    if (!prof) {
      const { data: newPro } = await sb.from('professionals').insert({
        user_id: session.user.id,
        specialty: 'General',
        city: '', province: '', description: ''
      }).select().maybeSingle();
      store.setCurrentPro(newPro);
    }
  }

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
  
  if (errEl) errEl.classList.add('hidden');

  if (!email || !pass) {
    showAuthError(errEl, 'Completá todos los campos.');
    return;
  }
  
  const btn = document.getElementById('btn-login');
  setBtnLoading(btn, 'Ingresando...');
  
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  
  setBtnLoading(btn, null, 'Ingresar');
  
  if (error) {
    showAuthError(errEl, translateAuthError(error.message));
  } else {
    closeModal('modal-login');
    showToast('¡Bienvenido de nuevo!', 'success');
    await redirectAfterLogin();
  }
}

export async function registerEmail() {
  const sb = getSupabase();
  const name     = document.getElementById('reg-name')?.value.trim();
  const email    = document.getElementById('reg-email')?.value.trim();
  const pass     = document.getElementById('reg-pass')?.value;
  const role     = document.getElementById('reg-role')?.value || 'user';
  const errEl    = document.getElementById('reg-error');
  
  if (errEl) errEl.classList.add('hidden');

  if (!name || !email || !pass) {
    showAuthError(errEl, 'Completá todos los campos obligatorios.');
    return;
  }
  if (pass.length < 6) {
    showAuthError(errEl, 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  // Datos extra para profesional
  const specialty = document.getElementById('reg-specialty')?.value || 'General';
  const city      = document.getElementById('reg-city')?.value.trim() || '';
  const province  = document.getElementById('reg-province')?.value.trim() || '';
  const whatsapp  = document.getElementById('reg-whatsapp')?.value.trim() || '';

  if (role === 'professional' && !specialty) {
    showAuthError(errEl, 'Seleccioná tu especialidad principal.');
    return;
  }

  const btn = document.getElementById('btn-register');
  setBtnLoading(btn, 'Creando cuenta...');

  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { full_name: name, role } }
  });

  setBtnLoading(btn, null, 'Crear cuenta');

  if (error) {
    showAuthError(errEl, translateAuthError(error.message));
    return;
  }

  // Crear perfil manualmente (por si el trigger falla)
  if (data.user) {
    await sb.from('profiles').upsert({
      id: data.user.id,
      full_name: name,
      role,
    }, { onConflict: 'id', ignoreDuplicates: true });

    if (role === 'professional') {
      await sb.from('professionals').upsert({
        user_id: data.user.id,
        specialty: specialty || 'General',
        city,
        province,
        whatsapp,
        description: ''
      }, { onConflict: 'user_id', ignoreDuplicates: true });
    }
  }

  closeModal('modal-register');

  // Si el email necesita confirmación
  if (data.user && !data.session) {
    showToast('¡Cuenta creada! Revisá tu email para verificar.', 'success');
  } else {
    showToast('¡Bienvenido/a a TECNIYA!', 'success');
    await redirectAfterLogin();
  }
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

export async function redirectAfterLogin() {
  if (store.currentRole === 'admin') {
    showPage('admin');
    const { loadAdminData } = await import('./admin.js');
    loadAdminData();
  } else if (store.currentRole === 'professional') {
    showPage('pro-dashboard');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else {
    showPage('user-dashboard');
    const { loadUserDashboard } = await import('./dashboard.js');
    loadUserDashboard();
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setBtnLoading(btn, loadingText, resetText) {
  if (!btn) return;
  if (loadingText) {
    btn.innerHTML = \`<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle;"></span>\${loadingText}\`;
    btn.disabled = true;
  } else {
    btn.innerHTML = resetText || btn.dataset.originalText || 'Confirmar';
    btn.disabled = false;
  }
}

function translateAuthError(msg) {
  const map = {
    'Invalid login credentials':         'Email o contraseña incorrectos.',
    'Email not confirmed':                'Confirmá tu email antes de ingresar.',
    'User already registered':            'Ya existe una cuenta con ese email.',
    'Password should be at least 6':      'La contraseña debe tener al menos 6 caracteres.',
    'Unable to validate email address':   'El formato del email no es válido.',
    'Email rate limit exceeded':          'Demasiados intentos. Esperá unos minutos.',
    'For security purposes':              'Por seguridad, esperá antes de intentar de nuevo.',
    'signup is disabled':                 'El registro está temporalmente deshabilitado.',
  };
  for (const [key, val] of Object.entries(map)) {
    if (msg.includes(key)) return val;
  }
  return msg;
}

export async function forgotPassword() {
  const sb = getSupabase();
  const email = document.getElementById('forgot-email')?.value.trim();
  const errEl = document.getElementById('forgot-error');
  const sucEl = document.getElementById('forgot-success');
  if (errEl) errEl.classList.add('hidden');
  if (sucEl) sucEl.classList.add('hidden');

  if (!email) { showAuthError(errEl, 'Ingresá tu email.'); return; }

  const btn = document.getElementById('btn-forgot-pass');
  setBtnLoading(btn, 'Enviando...');

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/?reset=true'
  });

  setBtnLoading(btn, null, 'Enviar link');

  if (error) {
    showAuthError(errEl, translateAuthError(error.message));
  } else {
    if (sucEl) {
      sucEl.textContent = '✓ Te enviamos un email con el link para restablecer tu contraseña.';
      sucEl.classList.remove('hidden');
    }
  }
}

export function initAuthEventListeners() {
  const loginEmailBtn = document.getElementById('btn-login');
  if (loginEmailBtn) loginEmailBtn.addEventListener('click', loginEmail);
  
  const registerEmailBtn = document.getElementById('btn-register');
  if (registerEmailBtn) registerEmailBtn.addEventListener('click', registerEmail);
  
  const loginPassInput = document.getElementById('login-pass');
  if (loginPassInput) {
    loginPassInput.addEventListener('keypress', e => { if (e.key === 'Enter') loginEmail(); });
  }
  const loginEmailInput = document.getElementById('login-email');
  if (loginEmailInput) {
    loginEmailInput.addEventListener('keypress', e => { if (e.key === 'Enter') loginEmail(); });
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

  // Olvidé mi contraseña
  document.getElementById('link-forgot-pass')?.addEventListener('click', e => {
    e.preventDefault(); closeModal('modal-login'); showModal('modal-forgot-pass');
  });
  document.getElementById('btn-forgot-pass')?.addEventListener('click', forgotPassword);
  document.getElementById('link-back-to-login')?.addEventListener('click', e => {
    e.preventDefault(); closeModal('modal-forgot-pass'); showModal('modal-login');
  });
}
