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
      console.log('Ads cargados:', allAds.length);
      allAds.forEach((a, i) => {
        console.log(`  [${i}] title: "${a.title}" | desc: "${a.description}" | level: "${a.level}" | link: "${a.link}"`);
      });
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
  console.log('[showAd] ===== INICIO =====');
  console.log('[showAd] level:', level);
  console.log('[showAd] store.allAds:', store.allAds?.length);
  console.log('[showAd] allAds (local):', allAds?.length);
  
  // Leer siempre del store para evitar problemas con módulos importados dinámicamente
  const ads = store.allAds?.length ? store.allAds : allAds;
  if (!ads || ads.length === 0) {
    console.warn('[showAd] NO HAY ADS DISPONIBLES');
    return;
  }

  console.log('[showAd] Ads disponibles:', ads.length, ads.map(a => a.title));

  // Buscar por nivel exacto, sino nacional, sino cualquiera
  let filtered = ads.filter(a => a.level === level);
  console.log('[showAd] filtered (level exacto):', filtered.length);
  if (!filtered.length) filtered = ads.filter(a => a.level === 'nacional' || !a.level);
  console.log('[showAd] filtered (nacional):', filtered.length);
  if (!filtered.length) filtered = ads;
  console.log('[showAd] filtered (final):', filtered.length);

  const ad = filtered[Math.floor(Math.random() * filtered.length)];
  if (!ad) {
    console.warn('[showAd] NO SE PUDO SELECCIONAR AD');
    return;
  }
  allAds = ads; // sincronizar variable local

  console.log('[showAd] AD SELECCIONADO:', ad.title);
  console.log('[showAd] Elementos DOM:');
  const titleEl  = document.getElementById('ad-title');
  const descEl   = document.getElementById('ad-desc');
  const badgeEl  = document.getElementById('ad-level-badge');
  const bannerEl = document.getElementById('ad-banner-main');
  const imgReal = document.getElementById('ad-img-real');
  const imgPlaceholder = document.getElementById('ad-img-placeholder');
  
  console.log('  - ad-title:', !!titleEl, titleEl);
  console.log('  - ad-desc:', !!descEl, descEl);
  console.log('  - ad-level-badge:', !!badgeEl, badgeEl);
  console.log('  - ad-banner-main:', !!bannerEl, bannerEl);
  console.log('  - ad-img-real:', !!imgReal, imgReal);
  console.log('  - ad-img-placeholder:', !!imgPlaceholder, imgPlaceholder);
  
  // DEBUG: Forzar visibilidad
  const adSection = document.querySelector('.ad-section');
  const adContent = document.querySelector('.ad-content');
  
  alert('DEBUG: showAd ejecutado! Banner debe verse ARRIBA DE TODO con fondo ROJO');
  console.log('[DEBUG] ad-section:', !!adSection, adSection);
  console.log('[DEBUG] ad-content:', !!adContent, adContent);
  
  if (adSection) {
    adSection.style.display = 'block !important';
    adSection.style.visibility = 'visible !important';
    adSection.style.opacity = '1 !important';
    adSection.style.position = 'relative';
    adSection.style.zIndex = '99999';
    console.log('[DEBUG] ad-section forzado');
  }
  if (adContent) {
    adContent.style.display = 'flex !important';
    console.log('[DEBUG] ad-content forzado');
  }
  if (bannerEl) {
    bannerEl.style.display = 'flex !important';
    bannerEl.style.background = 'red !important';
    bannerEl.style.minHeight = '150px';
    bannerEl.style.position = 'fixed';
    bannerEl.style.top = '0';
    bannerEl.style.left = '0';
    bannerEl.style.width = '100%';
    bannerEl.style.zIndex = '999999';
    console.log('[DEBUG] banner forzado a visible');
  }

  if (titleEl) {
    titleEl.textContent = ad.title || 'Publicidad';
    console.log('[showAd] Asignado title:', titleEl.textContent);
  }
  if (descEl) {
    descEl.textContent = ad.description || '';
    console.log('[showAd] Asignado desc:', descEl.textContent);
  }
  if (badgeEl) {
    const lbl = ad.level || level;
    badgeEl.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    badgeEl.className = `ad-level-badge ad-level-${lbl}`;
    console.log('[showAd] Asignado badge:', badgeEl.textContent);
  }
  if (bannerEl) {
    bannerEl.dataset.link = ad.link || '#';
    console.log('[showAd] Asignado link:', bannerEl.dataset.link);
  }

  // Mostrar imagen real o placeholder
  if (imgReal && imgPlaceholder) {
    if (ad.image_url) {
      imgReal.src = ad.image_url;
      imgReal.style.display = 'block';
      imgPlaceholder.style.display = 'none';
      console.log('[showAd] Imagen asignada:', ad.image_url);
    } else {
      imgReal.style.display = 'none';
      imgPlaceholder.style.display = 'flex';
      console.log('[showAd] Sin imagen, usando placeholder');
    }
  }
  console.log('[showAd] ===== FIN =====');
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
