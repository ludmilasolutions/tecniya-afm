import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast, closeModal } from './ui.js';
import { ADS_DEFAULT } from './config.js';

export let allAds = [];

export async function loadAds() {
  const sb = getSupabase();
  try {
    const { data } = await sb.from('ads').select('*').eq('active', true);
    allAds = (data && data.length > 0) ? data : ADS_DEFAULT;
  } catch {
    allAds = ADS_DEFAULT;
  }
  
  store.setAllAds(allAds);
  showAd('nacional');
}

export function showAd(level) {
  const filtered = allAds.filter(a => a.level === level || !a.level);
  const ad = filtered[Math.floor(Math.random() * filtered.length)] || allAds[0];
  
  if (!ad) return;
  
  const titleEl = document.getElementById('ad-title');
  const descEl = document.getElementById('ad-desc');
  const badgeEl = document.getElementById('ad-level-badge');
  const bannerEl = document.getElementById('ad-banner-main');
  
  if (titleEl) titleEl.textContent = ad.title || ad.name || 'Publicidad';
  if (descEl) descEl.textContent = ad.description || '';
  
  if (badgeEl) {
    badgeEl.textContent = level.charAt(0).toUpperCase() + level.slice(1);
    badgeEl.className = `ad-level-badge ad-level-${level}`;
  }
  
  if (bannerEl) {
    bannerEl.dataset.link = ad.link || '#';
  }
}

export async function onProvinceChange() {
  const prov = document.getElementById('filter-province')?.value;
  showAd(prov ? 'provincial' : 'nacional');
  
  const { applyFilters } = await import('./professionals.js');
  applyFilters();
}

export function onCityInput() {
  const city = document.getElementById('filter-city')?.value;
  const province = document.getElementById('filter-province')?.value;
  showAd(city ? 'local' : (province ? 'provincial' : 'nacional'));
}

export function openAdLink() {
  const bannerEl = document.getElementById('ad-banner-main');
  if (!bannerEl) return;
  
  const link = bannerEl.dataset.link;
  if (link && link !== '#') {
    window.open(link, '_blank');
  }
}

export async function saveAd() {
  const sb = getSupabase();
  const title = document.getElementById('ad-form-title')?.value.trim();
  const desc = document.getElementById('ad-form-desc')?.value.trim();
  const level = document.getElementById('ad-form-level')?.value;
  const link = document.getElementById('ad-form-link')?.value.trim();
  const province = document.getElementById('ad-form-province')?.value.trim();
  const city = document.getElementById('ad-form-city')?.value.trim();
  
  if (!title) {
    showToast('El título es obligatorio', 'error');
    return;
  }
  
  const { error } = await sb.from('ads').insert({
    title,
    description: desc,
    level,
    link,
    province,
    city,
    active: true,
    created_at: new Date().toISOString()
  });
  
  closeModal('modal-new-ad');
  
  if (error) {
    showToast('Error al crear publicidad', 'error');
  } else {
    showToast('Publicidad creada', 'success');
    loadAds();
    
    const { loadAdminData } = await import('./admin.js');
    loadAdminData();
  }
}
