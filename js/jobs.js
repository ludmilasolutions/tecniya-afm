import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showModal, closeModal, showToast } from './ui.js';
import { formatDate } from './utils.js';

export function openJobRequest(proId, proName, proUserId) {
  if (!store.currentUser) {
    showModal('modal-login');
    showToast('Iniciá sesión para solicitar trabajos', 'info');
    return;
  }
  
  // Guardar tanto el id de professionals como el user_id (que referencia profiles)
  const p = store.allProfessionals?.find(x => x.id == proId);
  store.setCurrentProIdForAction({ proId, userProfileId: proUserId || p?.user_id || proId });
  
  const proNameEl = document.getElementById('job-req-pro-name');
  if (proNameEl) proNameEl.textContent = proName;
  
  showModal('modal-request-job');
}

export async function submitJobRequest() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  const desc = document.getElementById('job-req-desc')?.value.trim();
  const address = document.getElementById('job-req-address')?.value.trim();
  const errorEl = document.getElementById('job-req-error');
  
  if (!desc) {
    if (errorEl) {
      errorEl.textContent = 'Describí el trabajo.';
      errorEl.classList.remove('hidden');
    }
    return;
  }
  
  const proAction = store.currentProIdForAction;
  let professionalProfileId = null;
  if (proAction?.userProfileId) {
    professionalProfileId = proAction.userProfileId;
  } else {
    const proId = proAction?.proId || proAction;
    const pro = store.allProfessionals?.find(x => x.id == proId);
    professionalProfileId = pro?.user_id || null;
  }

  // Validar que sea un UUID real (36 chars con guiones), no un mock ID como 'p1'
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (professionalProfileId && !uuidRegex.test(professionalProfileId)) {
    professionalProfileId = null;
  }

  const jobPayload = {
    user_id: store.currentUser.id,
    professional_id: professionalProfileId,
    specialty: document.getElementById('job-req-specialty')?.value || 'General',
    description: desc,
    address,
    status: 'solicitado',
    created_at: new Date().toISOString()
  };

  console.log('=== JOB INSERT PAYLOAD ===', JSON.stringify(jobPayload, null, 2));

  const { data, error } = await sb.from('jobs').insert(jobPayload).select();
  
  if (error) {
    console.error('=== JOB INSERT ERROR ===', JSON.stringify(error, null, 2));
    if (errorEl) {
      errorEl.textContent = error.message || JSON.stringify(error);
      errorEl.classList.remove('hidden');
    }
    return;
  }
  
  closeModal('modal-request-job');
  showToast('¡Solicitud enviada! El profesional te contactará pronto.', 'success');
}

export async function loadUserJobs() {
  if (!store.currentUser) return [];
  
  const sb = getSupabase();
  try {
    const { data } = await sb.from('jobs').select('*').eq('user_id', store.currentUser.id);
    return data || [];
  } catch {
    return [];
  }
}

export async function loadProJobs() {
  if (!store.currentPro) return [];
  
  const sb = getSupabase();
  try {
    const { data } = await sb.from('jobs').select('*').eq('professional_id', store.currentPro.id);
    return data || [];
  } catch {
    return [];
  }
}

export function jobItem(j, viewAs) {
  const statusMap = {
    solicitado: 'status-solicitado',
    aceptado: 'status-aceptado',
    en_proceso: 'status-en-proceso',
    finalizado: 'status-finalizado',
    cancelado: 'status-cancelado'
  };
  const statusLabel = {
    solicitado: 'Solicitado',
    aceptado: 'Aceptado',
    en_proceso: 'En proceso',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado'
  };
  
  return `<div class="job-item">
    <div class="job-icon" style="background:rgba(79,70,229,0.1);color:var(--primary);"><i class="fa fa-briefcase"></i></div>
    <div class="job-info">
      <div class="job-title">${j.description || 'Trabajo técnico'}</div>
      <div class="job-meta">${j.address || ''} · ${j.created_at ? formatDate(j.created_at) : ''}</div>
    </div>
    <span class="job-status ${statusMap[j.status] || ''}">${statusLabel[j.status] || j.status}</span>
    ${j.status === 'finalizado' && viewAs === 'user' ? `<button class="btn btn-ghost btn-sm" onclick="window.openRatingModal('${j.professional_id}','${j.id}')"><i class="fa fa-star"></i></button>` : ''}
    ${j.status === 'solicitado' && viewAs === 'pro' ? `<button class="btn btn-success btn-sm" onclick="window.acceptJob('${j.id}')">Aceptar</button>` : ''}
  </div>`;
}

export async function acceptJob(jobId) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ status: 'aceptado' }).eq('id', jobId);
  
  if (!error) {
    showToast('Trabajo aceptado', 'success');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  }
}

export async function updateJobStatus(jobId, status) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ status }).eq('id', jobId);
  
  if (!error) {
    showToast('Estado actualizado', 'success');
  }
}

export async function showUrgentModal() {
  if (!store.currentUser) {
    showModal('modal-login');
    showToast('Iniciá sesión para solicitar urgencias', 'info');
    return;
  }
  
  showModal('modal-urgent');
  
  const { detectLocation } = await import('./geolocation.js');
  detectLocation();
}

export async function sendUrgentRequest() {
  const sb = getSupabase();
  const specialty = document.getElementById('urgent-specialty')?.value;
  const desc = document.getElementById('urgent-desc')?.value.trim();
  const radius = document.getElementById('urgent-radius')?.value;
  
  if (!specialty || !desc) {
    showToast('Completá especialidad y descripción', 'error');
    return;
  }
  
  const { error } = await sb.from('urgent_requests').insert({
    user_id: store.currentUser.id,
    specialty,
    description: desc,
    radius,
    latitude: store.userLocation?.lat,
    longitude: store.userLocation?.lng,
    status: 'solicitado',
    created_at: new Date().toISOString()
  });
  
  closeModal('modal-urgent');
  
  if (error) {
    showToast('Error al enviar. Intente de nuevo.', 'error');
  } else {
    showToast('🚨 Solicitud urgente enviada. Notificando profesionales cercanos...', 'success');
  }
}

export function contactPro(proId, whatsapp) {
  if (whatsapp && whatsapp !== '') {
    const num = whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${num}?text=Hola! Te contacto desde TECNIYA para consultar sobre tus servicios.`, '_blank');
  } else {
    showToast('Este profesional no tiene WhatsApp registrado', 'info');
  }
}

export async function addFavorite(proId) {
  if (!store.currentUser) {
    showModal('modal-login');
    return;
  }
  
  // proId es el id de la tabla professionals, necesitamos el user_id que referencia profiles
  const pro = store.allProfessionals?.find(x => x.id == proId);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileId = (pro?.user_id && uuidRegex.test(pro.user_id)) ? pro.user_id : null;

  if (!profileId) {
    showToast('Este profesional es de demo, no se puede guardar en favoritos', 'info');
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from('favorites').insert({
    user_id: store.currentUser.id,
    professional_id: profileId,
    created_at: new Date().toISOString()
  });
  
  if (!error) {
    showToast('Añadido a favoritos', 'success');
  } else {
    showToast('Ya está en tus favoritos', 'info');
  }
}

export function openRatingModal(proId, jobId) {
  store.setCurrentProIdForAction({ proId, jobId });
  showModal('modal-rating');
}

export function setRating(event, category) {
  const container = document.getElementById('stars-' + category);
  if (!container) return;
  
  const stars = container.querySelectorAll('.star');
  const clickedVal = parseInt(event.target.dataset.v || event.target.closest('[data-v]')?.dataset.v || 0);
  
  if (!clickedVal) return;
  
  store.ratings[category] = clickedVal;
  stars.forEach((s, i) => {
    s.style.color = i < clickedVal ? 'var(--orange)' : 'var(--gray2)';
  });
}

export async function submitRating() {
  if (!store.currentUser || !store.currentProIdForAction) return;
  
  const sb = getSupabase();
  const comment = document.getElementById('rate-comment')?.value.trim();
  const avg = Object.values(store.ratings).reduce((a, b) => a + b, 0) / 4;
  
  const proId = store.currentProIdForAction.proId;
  const jobId = store.currentProIdForAction.jobId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pro = store.allProfessionals?.find(x => x.id == proId);
  const professionalProfileId = (pro?.user_id && uuidRegex.test(pro.user_id)) ? pro.user_id : null;

  if (!professionalProfileId) {
    showToast('No se puede calificar un profesional de demo', 'info');
    closeModal('modal-rating');
    return;
  }

  const { error } = await sb.from('reviews').insert({
    user_id: store.currentUser.id,
    professional_id: professionalProfileId,
    job_id: jobId,
    comment,
    rating: parseFloat(avg.toFixed(2)),
    puntualidad: store.ratings.puntualidad,
    calidad: store.ratings.calidad,
    precio: store.ratings.precio,
    comunicacion: store.ratings.comunicacion,
    created_at: new Date().toISOString()
  });
  
  closeModal('modal-rating');
  
  if (error) {
    showToast('Error al enviar calificación', 'error');
  } else {
    showToast('¡Gracias por tu calificación!', 'success');
  }
}

export async function initJobsEventListeners() {
  const urgentSpecialty = document.getElementById('urgent-specialty');
  if (urgentSpecialty) {
    const { loadSpecialties } = await import('./professionals.js');
    await loadSpecialties();
  }
}
