import { store } from './store.js';
import { CONFIG, SPECIALTIES_DEFAULT, MOCK_PROS } from './config.js';
import { renderProWarnings, renderProStats, openReportModal } from './security.js';
import { getSupabase } from './supabase.js';
import { showPage, showModal, showToast } from './ui.js';
import { generateStars, escapeHtml } from './utils.js';

export let allProfessionals = [];
export let allSpecialties = [];
export let activeFilters = store.activeFilters;

export async function loadSpecialties() {
  const sb = getSupabase();
  try {
    if (!sb) throw new Error('no sb');
    const { data } = await sb.from('specialties').select('*').order('name');
    allSpecialties = (data && data.length > 0) ? data.map(s => s.name) : SPECIALTIES_DEFAULT;
  } catch (e) {
    console.warn('loadSpecialties:', e?.message);
    allSpecialties = SPECIALTIES_DEFAULT;
  }
  
  store.setAllSpecialties(allSpecialties);
  window._allSpecialties = allSpecialties;
  
  const selects = ['filter-specialty', 'urgent-specialty', 'job-req-specialty'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const defaultOpt = el.options[0] ? el.options[0].text : '';
    el.innerHTML = `<option value="">${defaultOpt}</option>`;
    allSpecialties.forEach(s => el.innerHTML += `<option value="${s}">${s}</option>`);
  });
  // Si se pasa un selector externo (ej. reg-specialty del registro)
  if (arguments[0] instanceof HTMLElement) {
    const el = arguments[0];
    const defaultOpt = el.options[0] ? el.options[0].text : 'Seleccioná tu especialidad';
    el.innerHTML = `<option value="">${defaultOpt}</option>`;
    allSpecialties.forEach(s => el.innerHTML += `<option value="${s}">${s}</option>`);
  }
}

export async function loadProfessionals() {
  const sb = getSupabase();

  try {
    if (!sb) throw new Error('no sb');
    const { data, error } = await sb.from('v_professionals_public').select('*').limit(100);

    if (error) console.error('loadProfessionals:', error);

    allProfessionals = (data || []).map(p => ({
      id:            p.id,
      user_id:       p.user_id,
      name:          p.name || p.full_name || 'Profesional',
      avatar_url:    p.avatar_url || null,
      specialty:     p.specialties?.[0] || p.specialty,
      trust_score:    p.trust_score    ?? 100,
      ranking_score:  p.ranking_score  ?? 100,
      suspended:      p.suspended      ?? false,
      completed_jobs: p.completed_jobs ?? 0,
      report_count:   p.report_count   ?? 0,
      cancel_count:   p.cancel_count   ?? 0,
      avg_rating:     p.avg_rating     ?? null,
      specialties:   p.specialties || (p.specialty ? [p.specialty] : []),
      city:          p.city,
      province:      p.province,
      description:   p.description,
      rating:        parseFloat(p.avg_rating) || 0,
      reviews_count: p.reviews_count || 0,
      jobs_count:    p.jobs_count || 0,
      is_featured:   p.is_featured,
      is_certified:  p.is_certified,
      is_online:     p.is_online,
      zones:         p.zones || [],
      whatsapp:      p.whatsapp,
      lat:           p.latitude || null,
      lng:           p.longitude || null
    }));
  } catch (e) {
    console.error('loadProfessionals error:', e.message);
    allProfessionals = [];
  }

  store.setAllProfessionals(allProfessionals);
  renderAllSections();
}

export function rankingScore(p) {
  return (p.is_featured ? 40 : 0) + (p.is_certified ? 20 : 0) + (p.rating * 6) + Math.min(p.jobs_count * 0.05, 15);
}

export function renderAllSections() {
  const sorted     = [...allProfessionals].sort((a, b) => rankingScore(b) - rankingScore(a));
  const featured   = sorted.filter(p => p.is_featured);
  const certified  = sorted.filter(p => p.is_certified && !p.is_featured);
  const topRated   = sorted.filter(p => !p.is_featured && !p.is_certified).sort((a, b) => b.rating - a.rating);

  // Secciones del home: ocultar si no hay datos
  toggleSection('section-destacados', featured,  'grid-destacados',  featured.slice(0, 4));
  toggleSection('section-certificados',certified,'grid-certificados',certified.slice(0, 4));
  toggleSection('section-top',         topRated, 'grid-top',         topRated.slice(0, 4));

  updateCount('count-destacados',  featured.length);
  updateCount('count-certificados',certified.length);
  updateCount('count-top',         topRated.length);
  updateCount('count-all',         sorted.length);

  // Lista completa (página de búsqueda)
  renderGrid('grid-all',      sorted);
  renderGrid('grid-all-page', sorted);
}

function toggleSection(sectionId, items, gridId, slice) {
  const section = document.getElementById(sectionId);
  if (section) section.style.display = items.length ? '' : 'none';
  if (items.length) renderGrid(gridId, slice);
}

function updateCount(id, count) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = `${count} profesionales`;
  }
}

export function renderGrid(containerId, pros) {
  const el = document.getElementById(containerId);
  if (!el) return;
  
  if (!pros.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:40px;"><i class="fa fa-user-slash"></i><p>No se encontraron profesionales.</p></div>';
    return;
  }
  
  el.innerHTML = pros.map(p => proCard(p)).join('');
}

export function proCard(p) {
  const initial = (p.name || 'P').charAt(0).toUpperCase();
  const stars = generateStars(p.rating);
  const zones = (p.zones || []).slice(0, 3).map(z => `<span class="zone-tag">${escapeHtml(z)}</span>`).join('');
  const score = Math.round(rankingScore(p));
  const avatarContent = p.avatar_url
    ? `<img src="${p.avatar_url}" alt="${escapeHtml(p.name || '')}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`
    : initial;
  
  return `<div class="pro-card" data-pro-id="${p.id}" onclick="window.showProProfile('${p.id}')">
    <div class="pro-card-header">
      <span class="ranking-score" style="display:${score > 50 ? 'block' : 'none'}">★ ${score}</span>
      <div class="pro-avatar" style="${p.avatar_url ? 'padding:0;overflow:hidden;' : ''}">${avatarContent}${p.is_online ? '<span class="online-dot"></span>' : ''}</div>
      <div class="pro-info">
        <div class="pro-name">${escapeHtml(p.name) || 'Profesional'}</div>
        <div class="pro-specialties">${
          (p.specialties?.length ? p.specialties : [p.specialty||'Técnico'])
            .map(s => `<span class="specialty-chip">${escapeHtml(s)}</span>`).join('')
        }</div>
        <div class="pro-location"><i class="fa fa-location-dot"></i>${escapeHtml(p.city || '')}${p.province ? ', ' + escapeHtml(p.province) : ''}</div>
      </div>
      <div class="pro-badges">${p.is_featured ? '<span class="badge badge-destacado"><i class="fa fa-crown"></i>Destacado</span>' : ''}${p.is_certified ? '<span class="badge badge-certificado"><i class="fa fa-certificate"></i>Certificado</span>' : ''}</div>
    </div>
    <div class="pro-card-body">
      <div class="pro-trust" title="Confiabilidad basada en trabajos completados y comportamiento">
        <span style="font-size:0.72rem;color:var(--gray);">Confiabilidad</span>
        <div class="trust-score-bar">
          <div class="trust-score-fill" style="width:${p.trust_score||100}%;background:${
            (p.trust_score||100) >= 80 ? 'var(--green)' :
            (p.trust_score||100) >= 50 ? 'var(--orange)' : '#f87171'
          };"></div>
        </div>
        <span style="font-size:0.72rem;font-weight:700;color:${
          (p.trust_score||100) >= 80 ? 'var(--green)' :
          (p.trust_score||100) >= 50 ? 'var(--orange)' : '#f87171'
        };">${p.trust_score||100}%</span>
      </div>
      <div class="pro-rating"><div class="stars">${stars}</div><span class="rating-num">${p.rating ? p.rating.toFixed(1) : 'Nuevo'}</span><span class="rating-count">(${p.reviews_count || 0} reseñas)</span></div>
      <div class="pro-desc">${escapeHtml(p.description) || 'Profesional disponible para trabajos técnicos en tu zona.'}</div>
      <div class="pro-zones">${zones}</div>
    </div>
    <div class="pro-card-footer">
      <button class="btn btn-ghost btn-add-multi" data-pro-id="${p.id}" onclick="event.stopPropagation();window.toggleProSelection('${p.id}','${(p.name||'').replace(/'/g,'')}','${p.user_id||''}')" title="Agregar a solicitud múltiple"><i class="fa fa-plus-circle"></i></button>
      <button class="btn btn-primary" onclick="event.stopPropagation();window.openJobRequest('${p.id}','${(p.name || '').replace(/'/g, '')}','${p.user_id || ''}')"><i class="fa fa-paper-plane"></i>Solicitar</button>
    </div>
  </div>`;
}

export function showProProfile(proId) {
  store.setPreviousPage(getCurrentPageFromStore());
  
  const p = allProfessionals.find(x => x.id == proId) || MOCK_PROS.find(x => x.id == proId);
  if (!p) return;
  
  const initial = (p.name || 'P').charAt(0).toUpperCase();
  const stars = generateStars(p.rating);
  const avatarHtml = p.avatar_url
    ? `<img src="${p.avatar_url}" alt="${escapeHtml(p.name || '')}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<span class="pro-avatar-initial">${initial}</span>`;

  const trust = p.trust_score ?? 100;
  const trustColor = trust >= 80 ? 'var(--green)' : trust >= 50 ? 'var(--orange)' : '#f87171';
  const ratingPct = p.rating ? (p.rating / 5 * 100).toFixed(0) : 0;

  const badges = [
    p.is_featured  ? `<span class="ppro-badge ppro-badge--featured"><i class="fa fa-crown"></i>Destacado</span>` : '',
    p.is_certified ? `<span class="ppro-badge ppro-badge--certified"><i class="fa fa-certificate"></i>Certificado</span>` : '',
    p.is_online    ? `<span class="ppro-badge ppro-badge--online"><i class="fa fa-circle"></i>Disponible</span>` : '',
  ].filter(Boolean).join('');

  const specialtyChips = (p.specialties?.length ? p.specialties : [p.specialty || 'Técnico'])
    .map(s => `<span class="ppro-specialty">${escapeHtml(s)}</span>`).join('');

  const zoneHtml = (p.zones || []).map(z => `<span class="ppro-zone">${escapeHtml(z)}</span>`).join('')
    || `<span class="ppro-zone ppro-zone--empty">No especificado</span>`;

  document.getElementById('pro-profile-content').innerHTML = `
    <div class="ppro-wrap">

      <!-- HERO CARD -->
      <div class="ppro-hero">
        <div class="ppro-hero-bg" aria-hidden="true"></div>
        <div class="ppro-hero-inner">
          <div class="ppro-avatar-ring">
            <div class="ppro-avatar-lg">${avatarHtml}</div>
            ${p.is_online ? '<span class="ppro-online-dot" title="Disponible ahora"></span>' : ''}
          </div>
          <div class="ppro-hero-info">
            <div class="ppro-badges-row">${badges}</div>
            <h1 class="ppro-name">${escapeHtml(p.name || 'Profesional')}</h1>
            <div class="ppro-specialties-row">${specialtyChips}</div>
            <div class="ppro-location"><i class="fa fa-location-dot"></i> ${escapeHtml(p.city || '')}${p.province ? ', ' + escapeHtml(p.province) : ''}</div>
            <div class="ppro-rating-row">
              <div class="stars">${stars}</div>
              <span class="ppro-rating-num">${p.rating ? p.rating.toFixed(1) : '—'}</span>
              <span class="ppro-rating-meta">${p.reviews_count || 0} reseñas · ${p.jobs_count || 0} trabajos</span>
            </div>
          </div>
          <div class="ppro-hero-actions">
            <button class="btn btn-primary ppro-btn-main" onclick="window.openJobRequest('${p.id}','${(p.name||'').replace(/'/g,"\\'")}','${p.user_id || ''}')">
              <i class="fa fa-paper-plane"></i>Solicitar trabajo
            </button>
            <div class="ppro-btn-row">
              <button class="btn btn-ghost" onclick="window.openChatWith('${p.user_id || p.id}')"><i class="fa fa-comments"></i>Chat</button>
              <button class="btn btn-ghost" onclick="window.addFavorite('${p.id}')"><i class="fa fa-heart"></i>Favorito</button>
            </div>
          </div>
        </div>

        <!-- KPI strip -->
        <div class="ppro-kpi-strip">
          <div class="ppro-kpi">
            <span class="ppro-kpi-val ppro-kpi-val--green">${p.completed_jobs || 0}</span>
            <span class="ppro-kpi-label"><i class="fa fa-check-circle"></i>Completados</span>
          </div>
          <div class="ppro-kpi-divider"></div>
          <div class="ppro-kpi">
            <span class="ppro-kpi-val ppro-kpi-val--red">${p.cancel_count || 0}</span>
            <span class="ppro-kpi-label"><i class="fa fa-xmark"></i>Cancelaciones</span>
          </div>
          <div class="ppro-kpi-divider"></div>
          <div class="ppro-kpi">
            <span class="ppro-kpi-val ppro-kpi-val--orange">${p.avg_rating ? p.avg_rating.toFixed(1) : '—'}</span>
            <span class="ppro-kpi-label"><i class="fa fa-star"></i>Puntuación</span>
          </div>
          <div class="ppro-kpi-divider"></div>
          <div class="ppro-kpi">
            <span class="ppro-kpi-val" style="color:${trustColor};">${trust}%</span>
            <span class="ppro-kpi-label"><i class="fa fa-shield-halved"></i>Confiabilidad</span>
          </div>
        </div>
      </div>

      ${renderProWarnings(p) ? `<div class="ppro-warnings">${renderProWarnings(p)}</div>` : ''}

      <!-- BODY GRID -->
      <div class="ppro-body">

        <!-- LEFT COLUMN -->
        <div class="ppro-col-main">

          <!-- Sobre el profesional -->
          <div class="ppro-card">
            <div class="ppro-card-header">
              <span class="ppro-card-icon ppro-card-icon--accent"><i class="fa fa-user"></i></span>
              <h2 class="ppro-card-title">Sobre el profesional</h2>
            </div>
            <p class="ppro-desc">${escapeHtml(p.description) || 'Profesional técnico con experiencia en el rubro.'}</p>
            <div class="ppro-zones-section">
              <span class="ppro-zones-label"><i class="fa fa-map-marked-alt"></i>Zonas de cobertura</span>
              <div class="ppro-zones-list">${zoneHtml}</div>
            </div>
          </div>

          <!-- Reseñas -->
          <div class="ppro-card">
            <div class="ppro-card-header">
              <span class="ppro-card-icon ppro-card-icon--orange"><i class="fa fa-star"></i></span>
              <h2 class="ppro-card-title">Reseñas</h2>
            </div>
            <div class="reviews-list" id="pro-profile-reviews-${p.id}">
              <div class="empty-state" style="padding:28px;"><i class="fa fa-star"></i><p style="font-size:0.85rem;">Aún no tiene reseñas.</p></div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="ppro-col-side">

          <!-- Estadísticas -->
          <div class="ppro-card">
            <div class="ppro-card-header">
              <span class="ppro-card-icon ppro-card-icon--primary"><i class="fa fa-chart-bar"></i></span>
              <h2 class="ppro-card-title">Estadísticas</h2>
            </div>
            <div class="ppro-stats-list">
              <div class="ppro-stat-row">
                <span class="ppro-stat-name">Puntuación</span>
                <span class="ppro-stat-val ppro-stat-val--orange">${p.rating ? p.rating.toFixed(1) : '—'}<span class="ppro-stat-max">/5</span></span>
              </div>
              <div class="ppro-progress-bar"><div class="ppro-progress-fill ppro-progress-fill--orange" style="width:${ratingPct}%;"></div></div>

              <div class="ppro-stat-row" style="margin-top:14px;">
                <span class="ppro-stat-name">Trabajos</span>
                <strong class="ppro-stat-val">${p.jobs_count || 0}</strong>
              </div>
              <div class="ppro-stat-row">
                <span class="ppro-stat-name">Reseñas</span>
                <strong class="ppro-stat-val">${p.reviews_count || 0}</strong>
              </div>
              <div class="ppro-stat-row">
                <span class="ppro-stat-name">Confiabilidad</span>
                <strong class="ppro-stat-val" style="color:${trustColor};">${trust}%</strong>
              </div>
              <div class="ppro-progress-bar" style="margin-top:6px;"><div class="ppro-progress-fill" style="width:${trust}%;background:${trustColor};"></div></div>
            </div>
          </div>

          <!-- Fotos de trabajos -->
          <div class="ppro-card">
            <div class="ppro-card-header">
              <span class="ppro-card-icon ppro-card-icon--cyan"><i class="fa fa-images"></i></span>
              <h2 class="ppro-card-title">Fotos de trabajos</h2>
            </div>
            <div class="photos-grid ppro-photos" id="pro-profile-photos-${p.id}">
              <div class="empty-state" style="grid-column:1/-1;padding:20px;"><i class="fa fa-images"></i><p style="font-size:0.8rem;">Cargando...</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  
  showPage('pro-profile');
  loadProReviews(p.user_id || p.id, p.id);
  loadProWorkPhotos(p.id);
}

async function loadProWorkPhotos(proId) {
  const { getSupabase } = await import('./supabase.js');
  const sb = getSupabase();
  if (!sb) return;

  const container = document.getElementById(`pro-profile-photos-${proId}`);
  if (!container) return;

  const { data: photos } = await sb
    .from('work_photos')
    .select('id, photo_url, title')
    .eq('professional_id', proId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(6);

  if (!photos?.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:16px;"><i class="fa fa-images"></i><p style="font-size:0.8rem;">Sin fotos aún.</p></div>`;
    return;
  }

  container.innerHTML = photos.map(ph => `
    <div class="photo-thumb" style="background-image:url('${ph.photo_url}');background-size:cover;background-position:center;cursor:pointer;" 
         title="${escapeHtml(ph.title || '')}"
         onclick="window.open('${ph.photo_url}','_blank')">
    </div>
  `).join('');
}

async function loadProReviews(proUserId, proId) {
  const { getSupabase } = await import('./supabase.js');
  const sb = getSupabase();
  if (!sb) return;

  const { data: reviews } = await sb
    .from('reviews')
    .select('id, professional_id, user_id, rating, comment, puntualidad, calidad, precio, comunicacion, created_at')
    .eq('professional_id', proUserId)
    .order('created_at', { ascending: false })
    .limit(10);

  const container = document.getElementById(`pro-profile-reviews-${proId}`);
  if (!container) return;

  if (!reviews?.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px;"><i class="fa fa-star"></i><p style="font-size:0.85rem;">Aún no tiene reseñas.</p></div>`;
    return;
  }

  // Cargar nombres por separado para evitar join con FK nombrada
  const reviewerIds = [...new Set(reviews.map(r => r.user_id).filter(Boolean))];
  const namesMap = {};
  if (reviewerIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, full_name').in('id', reviewerIds);
    (profiles || []).forEach(p => { namesMap[p.id] = p.full_name; });
  }

  container.innerHTML = reviews.map(r => {
    const name    = namesMap?.[r.user_id] || 'Usuario';
    const stars   = generateStars(parseFloat(r.rating) || 0);
    const date    = r.created_at ? new Date(r.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' }) : '';
    return `<div class="review-item">
      <div class="review-top">
        <span class="reviewer-name">${escapeHtml(name)}</span>
        <div class="stars">${stars}</div>
        <span style="font-size:0.75rem;color:var(--gray);margin-left:auto;">${date}</span>
      </div>
      ${r.comment ? `<div class="review-text">${escapeHtml(r.comment)}</div>` : ''}
      <div class="review-categories">
        ${r.puntualidad ? `<div class="review-cat"><div class="review-cat-label">Puntualidad</div><div class="review-cat-score">${r.puntualidad}</div></div>` : ''}
        ${r.calidad     ? `<div class="review-cat"><div class="review-cat-label">Calidad</div><div class="review-cat-score">${r.calidad}</div></div>` : ''}
        ${r.precio      ? `<div class="review-cat"><div class="review-cat-label">Precio</div><div class="review-cat-score">${r.precio}</div></div>` : ''}
        ${r.comunicacion? `<div class="review-cat"><div class="review-cat-label">Comunicación</div><div class="review-cat-score">${r.comunicacion}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function getCurrentPageFromStore() {
  const active = document.querySelector('.page.active');
  return active ? active.id.replace('page-', '') : 'home';
}

export function toggleFilter(type) {
  store.toggleFilter(type);
  const el = document.getElementById('toggle-' + type);
  if (el) {
    el.classList.toggle('active', store.activeFilters[type]);
  }
  applyFilters();
}

export function applyFilters() {
  const specialty = document.getElementById('filter-specialty')?.value;
  const province = document.getElementById('filter-province')?.value;
  const city = document.getElementById('filter-city')?.value.toLowerCase();
  const zone = document.getElementById('filter-zone')?.value.toLowerCase();
  const sort = document.getElementById('filter-sort')?.value;
  const distance = parseInt(document.getElementById('filter-distance')?.value) || 0;
  
  let filtered = [...allProfessionals];
  
  if (specialty) filtered = filtered.filter(p => {
    const specs = p.specialties?.length ? p.specialties : [p.specialty];
    return specs.some(s => s === specialty);
  });
  if (province) filtered = filtered.filter(p => p.province === province);
  if (city) filtered = filtered.filter(p => (p.city || '').toLowerCase().includes(city));
  if (zone) filtered = filtered.filter(p => (p.zones || []).some(z => z.toLowerCase().includes(zone)));
  if (store.activeFilters.cert) filtered = filtered.filter(p => p.is_certified);
  if (store.activeFilters.dest) filtered = filtered.filter(p => p.is_featured);
  if (store.activeFilters.online) filtered = filtered.filter(p => p.is_online);

  const userLocation = store.userLocation;

  // Filtro por distancia
  if (distance && userLocation) {
    import('./geolocation.js').then(({ filterByDistance, sortByDistance }) => {
      const distFiltered = sortByDistance(filterByDistance(filtered, distance, userLocation), userLocation);
      renderGrid('grid-all', distFiltered);
      updateCount('count-all', distFiltered.length);
    });
    return;
  }

  if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
  else if (sort === 'jobs') filtered.sort((a, b) => (b.jobs_count || 0) - (a.jobs_count || 0));
  else if (sort === 'distance' && userLocation) {
    import('./geolocation.js').then(({ sortByDistance }) => {
      renderGrid('grid-all', sortByDistance(filtered, userLocation));
      updateCount('count-all', filtered.length);
    });
    return;
  }
  else filtered.sort((a, b) => rankingScore(b) - rankingScore(a));
  
  renderGrid('grid-all', filtered);
  updateCount('count-all', filtered.length);
}

export async function clearFilters() {
  ['filter-specialty', 'filter-province', 'filter-distance', 'filter-sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  ['filter-city', 'filter-zone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  store.setActiveFilters({ cert: false, dest: false, online: false });
  
  ['cert', 'dest', 'online'].forEach(t => {
    const el = document.getElementById('toggle-' + t);
    if (el) el.classList.remove('active');
  });
  
  renderAllSections();
  
  const { showAd } = await import('./ads.js');
  showAd('nacional');
}

export async function filterByType(type) {
  if (type === 'destacado') {
    store.setActiveFilters({ ...store.activeFilters, dest: true });
    document.getElementById('toggle-dest')?.classList.add('active');
  }
  if (type === 'certificado') {
    store.setActiveFilters({ ...store.activeFilters, cert: true });
    document.getElementById('toggle-cert')?.classList.add('active');
  }
  
  applyFilters();
  
  const { scrollToSearch } = await import('./ui.js');
  scrollToSearch();
}

export function initProfessionalsEvents() {
  const filterSpecialty = document.getElementById('filter-specialty');
  if (filterSpecialty) {
    filterSpecialty.addEventListener('change', applyFilters);
  }
  
  const filterProvince = document.getElementById('filter-province');
  if (filterProvince) {
    filterProvince.addEventListener('change', async () => {
      const { onProvinceChange } = await import('./ads.js');
      onProvinceChange();
    });
  }
  
  const filterCity = document.getElementById('filter-city');
  if (filterCity) {
    filterCity.addEventListener('input', async () => {
      const { onCityInput } = await import('./ads.js');
      onCityInput();
    });
  }
  
  const filterSort = document.getElementById('filter-sort');
  if (filterSort) {
    filterSort.addEventListener('change', applyFilters);
  }
  
  const toggleCert = document.getElementById('toggle-cert');
  if (toggleCert) {
    toggleCert.addEventListener('click', () => toggleFilter('cert'));
  }
  
  const toggleDest = document.getElementById('toggle-dest');
  if (toggleDest) {
    toggleDest.addEventListener('click', () => toggleFilter('dest'));
  }
  
  const toggleOnline = document.getElementById('toggle-online');
  if (toggleOnline) {
    toggleOnline.addEventListener('click', () => toggleFilter('online'));
  }
}
