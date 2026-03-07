import { store } from './store.js';
import { initSupabase } from './supabase.js';
import { initAuth, redirectAfterLogin, initAuthEventListeners } from './auth.js';
import { showPage, showModal, closeModal, toggleMobileMenu, toggleUserMenu, hideUserMenu,
         initUIEvents, animateStats, showToast, scrollToSearch, switchTab } from './ui.js';
import { loadProfessionals, loadSpecialties, renderAllSections, showProProfile,
         toggleFilter, applyFilters, clearFilters, filterByType, initProfessionalsEvents } from './professionals.js';
import { loadAds, openAdLink, saveAd } from './ads.js';
import { detectLocation } from './geolocation.js';
import { openJobRequest, submitJobRequest, showUrgentModal, sendUrgentRequest,
         contactPro, addFavorite, openRatingModal, setRating, submitRating,
         initJobsEventListeners } from './jobs.js';
import { loadUserDashboard, loadProDashboard, saveAvailability, saveProfile,
         saveProProfile, saveBudget, generateBudgetPDF, sendBudgetWhatsApp } from './dashboard.js';
import { loadAdminData, switchAdminTab, adminToggleBlock, adminToggleFeatured,
         adminDeleteAd, filterAdminTable } from './admin.js';
import { setupRealtimeNotifications, toggleNotifPanel, markAllRead, initNotificationsEvents } from './notifications.js';
import { sendChatMsg, sendChatMsgBtn, initChatEvents, loadChatPage } from './chat.js';
import { showSuscripcion, subscribePro } from './subscriptions.js';
import { initPWA, installPWA, generateManifest, initPWAEvents } from './pwa.js';
import { initStorage, initUploadEvents } from './upload.js';

// ─── Exponer globalmente (para onclick en HTML generado dinámicamente) ───────
window.showPage         = showPage;
window.closeModal       = closeModal;
window.showModal        = showModal;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleUserMenu   = toggleUserMenu;
window.hideUserMenu     = hideUserMenu;
window.showToast        = showToast;
window.scrollToSearch   = scrollToSearch;
window.switchTab        = switchTab;

window.showProProfile   = showProProfile;
window.applyFilters     = applyFilters;
window.clearFilters     = clearFilters;
window.filterByType     = filterByType;
window.toggleFilter     = toggleFilter;

window.openJobRequest   = openJobRequest;
window.submitJobRequest = submitJobRequest;
window.showUrgentModal  = showUrgentModal;
window.sendUrgentRequest= sendUrgentRequest;
window.contactPro       = contactPro;
window.addFavorite      = addFavorite;
window.openRatingModal  = openRatingModal;
window.setRating        = setRating;
window.submitRating     = submitRating;

window.showSuscripcion  = showSuscripcion;
window.subscribePro     = subscribePro;
window.installPWA       = installPWA;
window.detectLocation   = detectLocation;

window.loadAdminData      = loadAdminData;
window.switchAdminTab     = switchAdminTab;
window.adminToggleBlock   = adminToggleBlock;
window.adminToggleFeatured= adminToggleFeatured;
window.adminDeleteAd      = adminDeleteAd;
window.filterAdminTable   = filterAdminTable;

window.toggleNotifPanel = toggleNotifPanel;
window.markAllRead      = markAllRead;

window.saveAvailability = saveAvailability;
window.saveProfile      = saveProfile;
window.saveProProfile   = saveProProfile;
window.saveBudget       = saveBudget;
window.generateBudgetPDF= generateBudgetPDF;
window.sendBudgetWhatsApp=sendBudgetWhatsApp;

window.goBack = () => showPage(store.previousPage || 'home');

window.closeMobileMenu = () => {
  document.getElementById('mobile-nav')?.classList.remove('open');
};

window.acceptJob = async (jobId) => {
  const { acceptJob } = await import('./jobs.js');
  acceptJob(jobId);
};

// ─── Helper ─────────────────────────────────────────────────────────────────
function on(id, ev, fn) {
  document.getElementById(id)?.addEventListener(ev, fn);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
async function initApp() {
  await initSupabase();

  // Inicializar subsistemas
  initUIEvents();
  initAuthEventListeners();
  initProfessionalsEvents();
  initNotificationsEvents();
  initChatEvents();
  initPWAEvents();
  initJobsEventListeners();
  initPWA();

  // ── HEADER / NAV ────────────────────────────────────────────────────────
  on('logo-wrap',       'click', () => showPage('home'));
  on('hamburger-btn',   'click', toggleMobileMenu);

  on('nav-home',  'click', e => { e.preventDefault(); showPage('home'); });
  on('nav-pros',  'click', e => { e.preventDefault(); showPage('professionals-list'); });
  on('nav-how',   'click', e => { e.preventDefault(); showPage('how'); });
  on('nav-sub',   'click', e => { e.preventDefault(); showSuscripcion(); });

  on('mobile-home-link',  'click', e => { e.preventDefault(); showPage('home');                toggleMobileMenu(); });
  on('mobile-pros-link',  'click', e => { e.preventDefault(); showPage('professionals-list');  toggleMobileMenu(); });
  on('mobile-how-link',   'click', e => { e.preventDefault(); showPage('how');                 toggleMobileMenu(); });
  on('mobile-sub-link',   'click', e => { e.preventDefault(); showSuscripcion();               toggleMobileMenu(); });
  on('mobile-login-link', 'click', e => { e.preventDefault(); showModal('modal-login');        toggleMobileMenu(); });
  on('mobile-panel-link', 'click', e => { e.preventDefault(); redirectAfterLogin();            toggleMobileMenu(); });

  // ── MENÚ USUARIO ────────────────────────────────────────────────────────
  on('user-avatar-btn', 'click', e => { e.stopPropagation(); toggleUserMenu(); });
  on('menu-dashboard',  'click', e => { e.preventDefault(); redirectAfterLogin(); hideUserMenu(); });
  on('menu-profile',    'click', e => { e.preventDefault(); showPage('profile-edit'); hideUserMenu(); });
  on('menu-chat',       'click', e => { e.preventDefault(); showPage('chat'); loadChatPage(); hideUserMenu(); });
  on('menu-logout',     'click', e => { e.preventDefault(); import('./auth.js').then(m => m.logout()); hideUserMenu(); });
  // ── NOTIFICACIONES ──────────────────────────────────────────────────────
  on('notif-btn',        'click', toggleNotifPanel);
  on('mark-all-read-btn','click', markAllRead);

  // ── HERO ────────────────────────────────────────────────────────────────
  on('urgent-btn',  'click', showUrgentModal);
  on('search-btn',  'click', scrollToSearch);

  // ── BÚSQUEDA / FILTROS ──────────────────────────────────────────────────
  on('btn-search',           'click', () => { applyFilters(); showPage('professionals-list'); });
  on('btn-clear-filters',    'click', clearFilters);
  on('btn-detect-location',  'click', detectLocation);
  on('ad-banner-main',       'click', openAdLink);

  // ── VER TODOS ───────────────────────────────────────────────────────────
  on('see-all-destacados',   'click', () => { filterByType('destacado');   showPage('professionals-list'); });
  on('see-all-certificados', 'click', () => { filterByType('certificado'); showPage('professionals-list'); });
  on('see-all-top',          'click', () => {                               showPage('professionals-list'); });

  // ── FOOTER ──────────────────────────────────────────────────────────────
  on('footer-search',   'click', e => { e.preventDefault(); scrollToSearch(); });
  on('footer-how',      'click', e => { e.preventDefault(); showPage('how'); });
  on('footer-featured', 'click', e => { e.preventDefault(); showSuscripcion(); });
  on('footer-join',     'click', e => { e.preventDefault(); showModal('modal-register'); });
  on('footer-register', 'click', e => { e.preventDefault(); showModal('modal-register'); });
  on('footer-panel',    'click', e => { e.preventDefault(); redirectAfterLogin(); });
  on('link-search-pro', 'click', e => { e.preventDefault(); showPage('professionals-list'); });

  // ── MODALES AUTH ─────────────────────────────────────────────────────────
  on('link-to-register', 'click', e => { e.preventDefault(); closeModal('modal-login');    showModal('modal-register'); });
  on('link-to-login',    'click', e => { e.preventDefault(); closeModal('modal-register'); showModal('modal-login'); });

  // ── VOLVER ──────────────────────────────────────────────────────────────
  on('btn-back-pros',            'click', () => showPage(store.previousPage || 'home'));
  on('btn-back-profile',         'click', () => showPage(store.previousPage || 'home'));
  on('btn-back-profile-edit',    'click', () => showPage('user-dashboard'));
  on('btn-back-pro-profile-edit','click', () => showPage('pro-dashboard'));
  on('admin-back',               'click', () => showPage('home'));

  // ── DASHBOARD USUARIO ───────────────────────────────────────────────────
  on('btn-urgent-dash',  'click', showUrgentModal);
  on('btn-save-profile', 'click', saveProfile);

  // Tabs del dashboard de usuario
  document.querySelectorAll('#user-tabs .tab').forEach(tab => {
    tab.addEventListener('click', e => switchTab(e, tab.dataset.panel));
  });

  // ── DASHBOARD PROFESIONAL ────────────────────────────────────────────────
  on('btn-edit-pro-profile',  'click', () => showPage('pro-profile-edit'));
  on('btn-featured-pro',      'click', showSuscripcion);
  on('btn-save-availability', 'click', saveAvailability);
  on('btn-save-pro-profile',  'click', saveProProfile);
  on('btn-new-budget',        'click', () => showModal('modal-new-budget'));
  on('btn-save-budget',       'click', saveBudget);
  on('btn-pdf-budget',        'click', generateBudgetPDF);
  on('btn-whatsapp-budget',   'click', sendBudgetWhatsApp);
  on('btn-upload-photo',      'click', () => document.getElementById('pro-cert-file')?.click());
  on('pro-cert-file',         'change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const { uploadWorkPhoto } = await import('./upload.js');
    if (store.currentPro) await uploadWorkPhoto(file, store.currentPro.id);
  });

  // Tabs del dashboard profesional
  document.querySelectorAll('#pro-tabs .tab').forEach(tab => {
    tab.addEventListener('click', e => switchTab(e, tab.dataset.panel));
  });

  // ── ADMIN ────────────────────────────────────────────────────────────────
  on('btn-new-ad',  'click', () => showModal('modal-new-ad'));
  on('btn-save-ad', 'click', saveAd);

  // Sidebar del admin
  document.querySelectorAll('.admin-sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      if (tab) switchAdminTab(tab);
    });
  });

  // Buscador de admin
  on('search-users', 'input', e => filterAdminTable(e.target.value, 'users-table'));

  // ── MODALES DE JOBS ──────────────────────────────────────────────────────
  on('btn-submit-job',    'click', submitJobRequest);
  on('btn-send-urgent',   'click', sendUrgentRequest);
  on('btn-submit-rating', 'click', submitRating);

  // Estrellas de rating
  ['puntualidad','calidad','precio','comunicacion'].forEach(cat => {
    document.querySelectorAll(`#stars-${cat} .star`).forEach(star => {
      star.addEventListener('click', e => setRating(e, cat));
    });
  });

  // ── SUSCRIPCIÓN ──────────────────────────────────────────────────────────
  on('btn-subscribe',    'click', subscribePro);

  // ── CÓMO FUNCIONA ────────────────────────────────────────────────────────
  on('btn-register-how', 'click', () => showModal('modal-register'));

  // ── CHAT ─────────────────────────────────────────────────────────────────
  on('btn-send-chat', 'click', sendChatMsgBtn);
  on('chat-input-field', 'keypress', sendChatMsg);

  // ── PWA ──────────────────────────────────────────────────────────────────
  on('btn-install-pwa', 'click', installPWA);
  on('btn-close-pwa',   'click', () => document.getElementById('pwa-banner')?.classList.add('pwa-banner-hidden'));

  // ── MODAL - cerrar con botones data-close ────────────────────────────────
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // ─── CARGA INICIAL ──────────────────────────────────────────────────────
  generateManifest();

  await loadSpecialties();
  await loadAds();
  await loadProfessionals();

  initStorage();
  initUploadEvents();
  animateStats();
  setupRealtimeNotifications();

  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }, 1200);

  initAuth();
}

window.addEventListener('DOMContentLoaded', initApp);
