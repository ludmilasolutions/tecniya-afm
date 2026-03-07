import { store } from './store.js';
import { getSupabase, initSupabase } from './supabase.js';
import { initAuth, handleSession, handleLogout, redirectAfterLogin, initAuthEventListeners } from './auth.js';
import { showPage, showModal, closeModal, toggleMobileMenu, toggleUserMenu, hideUserMenu, initUIEvents, animateStats, updateAuthUI, showToast, scrollToSearch, switchTab } from './ui.js';
import { loadProfessionals, loadSpecialties, renderAllSections, showProProfile, toggleFilter, applyFilters, clearFilters, filterByType, initProfessionalsEvents } from './professionals.js';
import { loadAds, onProvinceChange, onCityInput, openAdLink, saveAd, showAd } from './ads.js';
import { detectLocation } from './geolocation.js';
import { openJobRequest, submitJobRequest, showUrgentModal, sendUrgentRequest, contactPro, addFavorite, openRatingModal, setRating, submitRating, initJobsEventListeners } from './jobs.js';
import { loadUserDashboard, loadProDashboard, saveAvailability, saveProfile, saveProProfile, saveBudget, generateBudgetPDF, sendBudgetWhatsApp } from './dashboard.js';
import { loadAdminData, switchAdminTab, blockUser, approveFeatured, deleteAd, filterAdminTable } from './admin.js';
import { setupRealtimeNotifications, setupNotifBadge, toggleNotifPanel, markAllRead, initNotificationsEvents } from './notifications.js';
import { sendChatMsg, sendChatMsgBtn, initChatEvents } from './chat.js';
import { showSuscripcion, subscribePro } from './subscriptions.js';
import { initPWA, installPWA, generateManifest, initPWAEvents } from './pwa.js';

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
window.blockUser = blockUser;
window.approveFeatured = approveFeatured;
window.deleteAd = deleteAd;
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
  if (mobileNav) {
    mobileNav.classList.remove('open');
  }
};

export async function initApp() {
  await initSupabase();
  
  initUIEvents();
  initAuthEventListeners();
  initProfessionalsEvents();
  initNotificationsEvents();
  initChatEvents();
  initPWAEvents();
  initJobsEventListeners();
  
  generateManifest();
  
  await loadSpecialties();
  await loadAds();
  await loadProfessionals();
  
  animateStats();
  
  setupRealtimeNotifications();
  
  setTimeout(() => {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }, 1200);
  
  initAuth();
}

window.addEventListener('DOMContentLoaded', initApp);

const logoWrap = document.querySelector('.logo-wrap');
if (logoWrap) {
  logoWrap.addEventListener('click', () => showPage('home'));
}

const hamburger = document.querySelector('.hamburger');
if (hamburger) {
  hamburger.addEventListener('click', toggleMobileMenu);
}
