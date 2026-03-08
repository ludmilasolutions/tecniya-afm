import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast, closeModal } from './ui.js';
import { ADS_DEFAULT } from './config.js';

export let allAds = [];

export async function loadAds() {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.from('ads').select('*').eq('active', true);
    if (error) {
      console.warn('loadAds error:', error.message);
      allAds = ADS_DEFAULT;
    } else {
      allAds = (data && data.length > 0) ? data : ADS_DEFAULT;
      console.log('Ads cargados:', allAds.length, allAds.map(a => a.title));
    }
  } catch(e) {
    console.warn('loadAds exception:', e.message);
    allAds = ADS_DEFAULT;
  }
  store.setAllAds(allAds);
  showAd('nacional');
  setTimeout(() => showAd('nacional'), 500);
}

export function showAd(level) {
  // Leer siempre del store para evitar problemas con módulos importados dinámicamente
  const ads = store.allAds?.length ? store.allAds : allAds;
  if (!ads || ads.length === 0) return;

  // Buscar por nivel exacto, sino nacional, sino cualquiera
  let filtered = ads.filter(a => a.level === level);
  if (!filtered.length) filtered = ads.filter(a => a.level === 'nacional' || !a.level);
  if (!filtered.length) filtered = ads;

  const ad = filtered[Math.floor(Math.random() * filtered.length)];
  if (!ad) return;
  allAds = ads; // sincronizar variable local

  const titleEl  = document.getElementById('ad-title');
  const descEl   = document.getElementById('ad-desc');
  const badgeEl  = document.getElementById('ad-level-badge');
  const bannerEl = document.getElementById('ad-banner-main');

  if (titleEl)  titleEl.textContent  = ad.title || 'Publicidad';
  if (descEl)   descEl.textContent   = ad.description || '';
  if (badgeEl) {
    const lbl = ad.level || level;
    badgeEl.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    badgeEl.className   = `ad-level-badge ad-level-${lbl}`;
  }
  if (bannerEl) {
    bannerEl.dataset.link = ad.link || '#';
  }

  // Mostrar imagen real o placeholder
  const imgReal = document.getElementById('ad-img-real');
  const imgPlaceholder = document.getElementById('ad-img-placeholder');
  if (imgReal && imgPlaceholder) {
    if (ad.image_url) {
      imgReal.src = ad.image_url;
      imgReal.style.display = 'block';
      imgPlaceholder.style.display = 'none';
    } else {
      imgReal.style.display = 'none';
      imgPlaceholder.style.display = 'flex';
    }
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
