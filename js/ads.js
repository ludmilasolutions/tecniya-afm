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
  const ads = store.allAds?.length ? store.allAds : allAds;
  if (!ads || ads.length === 0) return;

  let filtered = ads.filter(a => a.level === level);
  if (!filtered.length) filtered = ads.filter(a => a.level === 'nacional' || !a.level);
  if (!filtered.length) filtered = ads;

  const ad = filtered[Math.floor(Math.random() * filtered.length)];
  if (!ad) return;

  renderAdBanner(ad);
}

function renderAdBanner(ad) {
  let banner = document.getElementById('custom-ad-banner');
  
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'custom-ad-banner';
    banner.style.cssText = `
      position: relative;
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 20px 28px;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(6, 182, 212, 0.2));
      border: 1px solid rgba(79, 70, 229, 0.4);
      border-radius: 14px;
      display: flex;
      align-items: center;
      gap: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 16px;
      box-sizing: border-box;
    `;
    banner.onclick = () => {
      if (ad.link && ad.link !== '#') {
        window.open(ad.link, '_blank');
      }
    };
    
    // Insertar antes del search-section
    const searchSection = document.getElementById('search-section');
    if (searchSection && searchSection.parentElement) {
      searchSection.parentElement.insertBefore(banner, searchSection);
    } else {
      // Fallback: insertar en el container
      const container = document.querySelector('.container');
      if (container) {
        container.insertBefore(banner, container.firstChild);
      }
    }
  }

  // Aplicar transformación de imagen guardada
  const imgZoom = ad.image_zoom || 1;
  const imgPosX = ad.image_posX || 0;
  const imgPosY = ad.image_posY || 0;
  const imgStyle = `width:80px;height:80px;border-radius:10px;object-fit:cover;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.3);transform:scale(${imgZoom}) translate(${imgPosX}px, ${imgPosY}px);`;
  
  // Imagen más grande - 80px en vez de 50px
  const imageHtml = ad.image_url 
    ? `<img src="${ad.image_url}" style="${imgStyle}" alt="${ad.title}">`
    : `<div style="width:80px;height:80px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#06b6d4);display:flex;align-items:center;justify-content:center;color:white;font-size:28px;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><i class="fa fa-bullhorn"></i></div>`;
  
  // Sin badge de nivel - solo título y descripción
  banner.innerHTML = `
    ${imageHtml}
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 700; font-size: 1.15rem; color: #f8fafc; margin-bottom: 4px;">${ad.title || 'Publicidad'}</div>
      <div style="font-size: 0.9rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ad.description || ''}</div>
    </div>
  `;
  
  banner.onmouseenter = () => {
    banner.style.borderColor = 'rgba(79, 70, 229, 0.7)';
    banner.style.transform = 'translateY(-2px)';
    banner.style.boxShadow = '0 8px 25px rgba(79, 70, 229, 0.3)';
  };
  banner.onmouseleave = () => {
    banner.style.borderColor = 'rgba(79, 70, 229, 0.4)';
    banner.style.transform = 'translateY(0)';
    banner.style.boxShadow = 'none';
  };
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
  const bannerEl = document.getElementById('custom-ad-banner');
  if (!bannerEl) return;
  
  const ads = store.allAds?.length ? store.allAds : allAds;
  if (ads && ads.length > 0) {
    const ad = ads[0];
    if (ad.link && ad.link !== '#') {
      window.open(ad.link, '_blank');
    }
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
