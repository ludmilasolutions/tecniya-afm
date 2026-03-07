import { store } from './store.js';
import { getSupabase, initSupabase } from './supabase.js';
import { initAuth, handleSession, handleLogout, redirectAfterLogin, initAuthEventListeners } from './auth.js';
import { showPage, showModal, closeModal, toggleMobileMenu, toggleUserMenu, hideUserMenu, initUIEvents, animateStats, updateAuthUI, showToast, scrollToSearch, switchTab } from './ui.js';
import { loadProfessionals, loadSpecialties, renderAllSections, showProProfile, toggleFilter, applyFilters, clearFilters, filterByType, initProfessionalsEvents } from './professionals.js';
import { loadAds, onProvinceChange, onCityInput, openAdLink, saveAd, showAd } from './ads.js';
import { detectLocation } from './geolocation.js';
import { openJobRequest, submitJobRequest, showUrgentModal, sendUrgentRequest, contactPro, addFavorite, openRatingModal, setRating, submitRating, initJobsEventListeners } from './jobs.js';
import { loadUserDashboard, loadProDashboard, saveAvailability, saveProfile, saveProProfile, saveBudget, generateBudgetPDF, sendBudgetWhatsApp } from './dashboard.js';
import { loadAdminData, switchAdminTab, adminToggleBlock, adminToggleFeatured, adminDeleteAd, filterAdminTable } from './admin.js';
import { setupRealtimeNotifications, setupNotifBadge, toggleNotifPanel, markAllRead, initNotificationsEvents } from './notifications.js';
import { sendChatMsg, sendChatMsgBtn, initChatEvents } from './chat.js';
import { showSuscripcion, subscribePro } from './subscriptions.js';
import { initPWA, installPWA, generateManifest, initPWAEvents } from './pwa.js';
import { initStorage, initUploadEvents, loadWorkPhotos, loadCertifications } from './upload.js';

// Exponer funciones globalmente para uso en HTML inline
window.showPage = showPage;
window.closeModal = closeModal;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleUserMenu = toggleUserMenu;
window.hideUserMenu = hideUserMenu;
window.showToast = showToast;
window.scrollToSearch = scrollToSearch;
window.switchTab = switchTab;

window.loadProfessionals = loadProfessionals;
window.loadSpecialties = loadSpecialties;
window.showProProfile = showProProfile;
window.toggleFilter = toggleFilter;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.filterByType = filterByType;

window.loadAds = loadAds;
window.onProvinceChange = onProvinceChange;
window.onCityInput = onCityInput;
window.openAdLink = openAdLink;
window.saveAd = saveAd;
window.showAd = showAd;

window.detectLocation = detectLocation;

window.openJobRequest = openJobRequest;
window.submitJobRequest = submitJobRequest;
window.showUrgentModal = showUrgentModal;
window.sendUrgentRequest = sendUrgentRequest;
window.contactPro = contactPro;
window.addFavorite = addFavorite;
window.openRatingModal = openRatingModal;
window.setRating = setRating;
window.submitRating = submitRating;

window.loadUserDashboard = loadUserDashboard;
window.loadProDashboard = loadProDashboard;
window.saveAvailability = saveAvailability;
window.saveProfile = saveProfile;
window.saveProProfile = saveProProfile;
window.saveBudget = saveBudget;
window.generateBudgetPDF = generateBudgetPDF;
window.sendBudgetWhatsApp = sendBudgetWhatsApp;

window.loadAdminData = loadAdminData;
window.switchAdminTab = switchAdminTab;
window.adminToggleBlock = adminToggleBlock;
window.adminToggleFeatured = adminToggleFeatured;
window.adminDeleteAd = adminDeleteAd;
window.filterAdminTable = filterAdminTable;

window.toggleNotifPanel = toggleNotifPanel;
window.markAllRead = markAllRead;

window.sendChatMsg = sendChatMsg;
window.sendChatMsgBtn = sendChatMsgBtn;

window.showSuscripcion = showSuscripcion;
window.subscribePro = subscribePro;

window.installPWA = installPWA;

window.goBack = () => {
  const prev = store.previousPage || 'home';
  showPage(prev);
};

window.acceptJob = async (jobId) => {
  const { acceptJob } = await import('./jobs.js');
  acceptJob(jobId);
};

window.closeMobileMenu = () => {
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) mobileNav.classList.remove('open');
};

async function initApp() {
  await initSupabase();
  
  initUIEvents();
  initAuthEventListeners();  // incluye botones login/register/google/logout/nav
  initProfessionalsEvents();
  initNotificationsEvents();
  initChatEvents();
  initPWAEvents();
  initJobsEventListeners();
  initPWA();

  // Navegación principal
  document.getElementById('nav-home')?.addEventListener('click', e => { e.preventDefault(); showPage('home'); });
  document.getElementById('nav-pros')?.addEventListener('click', e => { e.preventDefault(); showPage('professionals-list'); });
  document.getElementById('nav-how')?.addEventListener('click', e => { e.preventDefault(); showPage('how'); });
  document.getElementById('nav-sub')?.addEventListener('click', e => { e.preventDefault(); showSuscripcion(); });

  document.getElementById('mobile-home-link')?.addEventListener('click', e => { e.preventDefault(); showPage('home'); toggleMobileMenu(); });
  document.getElementById('mobile-pros-link')?.addEventListener('click', e => { e.preventDefault(); showPage('professionals-list'); toggleMobileMenu(); });
  document.getElementById('mobile-how-link')?.addEventListener('click', e => { e.preventDefault(); showPage('how'); toggleMobileMenu(); });
  document.getElementById('mobile-sub-link')?.addEventListener('click', e => { e.preventDefault(); showSuscripcion(); toggleMobileMenu(); });
  document.getElementById('mobile-panel-link')?.addEventListener('click', e => { e.preventDefault(); redirectAfterLogin(); toggleMobileMenu(); });

  // Logo y hamburger
  document.getElementById('logo-wrap')?.addEventListener('click', () => showPage('home'));
  document.getElementById('hamburger-btn')?.addEventListener('click', toggleMobileMenu);

  // Avatar / menú usuario
  document.getElementById('user-avatar-btn')?.addEventListener('click', toggleUserMenu);
  document.getElementById('menu-dashboard')?.addEventListener('click', e => { e.preventDefault(); redirectAfterLogin(); hideUserMenu(); });
  document.getElementById('menu-profile')?.addEventListener('click', e => { e.preventDefault(); showPage('profile-edit'); hideUserMenu(); });
  document.getElementById('menu-chat')?.addEventListener('click', e => { e.preventDefault(); showPage('chat'); hideUserMenu(); });

  // Botones de home
  document.getElementById('search-btn')?.addEventListener('click', scrollToSearch);
  document.getElementById('btn-search')?.addEventListener('click', applyFilters);
  document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);
  document.getElementById('btn-detect-location')?.addEventListener('click', detectLocation);

  // Botones de volver
  document.getElementById('btn-back-pros')?.addEventListener('click', () => showPage(store.previousPage || 'home'));
  document.getElementById('btn-back-profile')?.addEventListener('click', () => showPage(store.previousPage || 'home'));
  document.getElementById('btn-back-profile-edit')?.addEventListener('click', () => showPage('user-dashboard'));
  document.getElementById('btn-back-pro-profile-edit')?.addEventListener('click', () => showPage('pro-dashboard'));

  // Dashboard usuario
  document.getElementById('btn-urgent-dash')?.addEventListener('click', showUrgentModal);
  document.getElementById('btn-save-profile')?.addEventListener('click', saveProfile);

  // Dashboard profesional
  document.getElementById('btn-edit-pro-profile')?.addEventListener('click', () => showPage('pro-profile-edit'));
  document.getElementById('btn-featured-pro')?.addEventListener('click', showSuscripcion);
  document.getElementById('btn-save-availability')?.addEventListener('click', saveAvailability);
  document.getElementById('btn-save-pro-profile')?.addEventListener('click', saveProProfile);
  document.getElementById('btn-upload-photo')?.addEventListener('click', () => document.getElementById('photo-input')?.click());
  document.getElementById('btn-new-budget')?.addEventListener('click', () => showModal('modal-budget'));
  document.getElementById('btn-save-budget')?.addEventListener('click', saveBudget);
  document.getElementById('btn-pdf-budget')?.addEventListener('click', generateBudgetPDF);
  document.getElementById('btn-whatsapp-budget')?.addEventListener('click', sendBudgetWhatsApp);

  // Admin
  document.getElementById('btn-new-ad')?.addEventListener('click', () => showModal('modal-new-ad'));
  document.getElementById('btn-save-ad')?.addEventListener('click', saveAd);

  // Chat
  document.getElementById('btn-send-chat')?.addEventListener('click', sendChatMsgBtn);

  // Modales de jobs
  document.getElementById('btn-submit-job')?.addEventListener('click', submitJobRequest);
  document.getElementById('btn-send-urgent')?.addEventListener('click', sendUrgentRequest);
  document.getElementById('btn-submit-rating')?.addEventListener('click', submitRating);

  // Suscripción
  document.getElementById('btn-subscribe')?.addEventListener('click', subscribePro);

  // PWA banner
  document.getElementById('btn-install-pwa')?.addEventListener('click', installPWA);
  document.getElementById('btn-close-pwa')?.addEventListener('click', () => {
    document.getElementById('pwa-banner')?.classList.add('pwa-banner-hidden');
  });

  // Registro profesional desde "Cómo funciona"
  document.getElementById('btn-register-how')?.addEventListener('click', () => showModal('modal-register'));

  // Banner de ad
  document.getElementById('ad-banner-main')?.addEventListener('click', openAdLink);

  // Notificaciones
  document.getElementById('mark-all-read-btn')?.addEventListener('click', markAllRead);

  generateManifest();

  await loadSpecialties();
  await loadAds();
  await loadProfessionals();

  initStorage();
  initUploadEvents();

  animateStats();
  setupRealtimeNotifications();

  setTimeout(() => {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }, 1200);

  initAuth();
}

window.addEventListener('DOMContentLoaded', initApp);
