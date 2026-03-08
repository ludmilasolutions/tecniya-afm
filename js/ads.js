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
      padding: 16px 24px;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(6, 182, 212, 0.15));
      border: 1px solid rgba(79, 70, 229, 0.3);
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
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
    
    const container = document.querySelector('.container');
    if (container) {
      container.insertBefore(banner, container.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  const levelLabel = ad.level === 'nacional' ? 'NACIONAL' : ad.level === 'provincial' ? 'PROVINCIAL' : 'LOCAL';
  const levelColor = ad.level === 'nacional' ? '#8b5cf6' : ad.level === 'provincial' ? '#06b6d4' : '#10b981';
  
  banner.innerHTML = `
    <div style="flex-shrink: 0; width: 50px; height: 50px; border-radius: 8px; background: linear-gradient(135deg, #4f46e5, #06b6d4); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
      <i class="fa fa-bullhorn"></i>
    </div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 700; font-size: 1rem; color: #f8fafc; margin-bottom: 2px;">${ad.title || 'Publicidad'}</div>
      <div style="font-size: 0.85rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ad.description || ''}</div>
    </div>
    <div style="flex-shrink: 0; padding: 4px 10px; border-radius: 4px; background: ${levelColor}20; border: 1px solid ${levelColor}40; color: ${levelColor}; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
      ${levelLabel}
    </div>
  `;
  
  banner.onmouseenter = () => {
    banner.style.borderColor = 'rgba(79, 70, 229, 0.6)';
    banner.style.transform = 'translateY(-2px)';
  };
  banner.onmouseleave = () => {
    banner.style.borderColor = 'rgba(79, 70, 229, 0.3)';
    banner.style.transform = 'translateY(0)';
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
