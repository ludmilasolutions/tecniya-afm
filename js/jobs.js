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
  // Bloquear si el usuario es el mismo profesional
  const resolvedUserId = proUserId || store.allProfessionals?.find(x => x.id == proId)?.user_id;
  if (resolvedUserId && resolvedUserId === store.currentUser.id) {
    showToast('No podés enviarte trabajos a vos mismo.', 'warning');
    return;
  }
  const p = store.allProfessionals?.find(x => x.id == proId);
  store.setCurrentProIdForAction({ proId, userProfileId: resolvedUserId || proId });
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

const STATUS_CSS = {
  solicitado: 'status-solicitado',
  aceptado:   'status-aceptado',
  en_proceso: 'status-en-proceso',
  finalizado: 'status-finalizado',
  cancelado:  'status-cancelado',
  rechazado:  'status-cancelado'
};
const STATUS_LABEL = {
  solicitado: 'Nuevo',
  aceptado:   'Aceptado',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
  cancelado:  'Cancelado',
  rechazado:  'Rechazado'
};
const STATUS_ICON = {
  solicitado: 'fa-clock',
  aceptado:   'fa-check',
  en_proceso: 'fa-gears',
  finalizado: 'fa-check-circle',
  cancelado:  'fa-times-circle',
  rechazado:  'fa-times-circle'
};

export function jobItem(j, viewAs) {
  const statusCss   = STATUS_CSS[j.status]   || '';
  const statusTxt   = STATUS_LABEL[j.status] || j.status;
  const statusIcon  = STATUS_ICON[j.status]  || 'fa-briefcase';
  const dateStr     = j.created_at ? formatDate(j.created_at) : '';
  const specialty   = j.specialty ? `<span style="font-size:0.78rem;background:rgba(79,70,229,0.12);color:var(--primary);padding:2px 8px;border-radius:20px;">${j.specialty}</span>` : '';
  const desc        = j.description ? `<div class="job-title">${escHtml(j.description)}</div>` : '';
  const meta        = [j.address, dateStr].filter(Boolean).join(' · ');
  const isUrgent    = j.is_urgent ? `<span style="font-size:0.75rem;background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 8px;border-radius:20px;"><i class="fa fa-bolt"></i> Urgente</span>` : '';

  // Acciones según rol y estado
  let actions = '';
  if (viewAs === 'pro') {
    if (j.status === 'solicitado') {
      actions = `
        <button class="btn btn-success btn-sm" onclick="window.acceptJob('${j.id}')"><i class="fa fa-check"></i>Aceptar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.rejectJob('${j.id}')"><i class="fa fa-times"></i>Rechazar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'aceptado') {
      actions = `
        <button class="btn btn-primary btn-sm" onclick="window.startJob('${j.id}')"><i class="fa fa-play"></i>Iniciar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'en_proceso') {
      actions = `
        <button class="btn btn-success btn-sm" onclick="window.finishJob('${j.id}')"><i class="fa fa-flag-checkered"></i>Finalizar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    }
  } else if (viewAs === 'user') {
    if (['solicitado','aceptado','en_proceso'].includes(j.status)) {
      actions = `<button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.professional_id}')"><i class="fa fa-comments"></i>Chat</button>
        <button class="btn btn-ghost btn-sm" onclick="window.cancelJob('${j.id}')"><i class="fa fa-times"></i>Cancelar</button>`;
    } else if (j.status === 'finalizado') {
      actions = `<button class="btn btn-orange btn-sm" onclick="window.openRatingModal('${j.professional_id}','${j.id}')"><i class="fa fa-star"></i>Calificar</button>`;
    }
  }

  return `<div class="job-item" style="flex-wrap:wrap;gap:10px;padding:16px;">
    <div class="job-icon" style="background:rgba(79,70,229,0.1);color:var(--primary);flex-shrink:0;">
      <i class="fa ${statusIcon}"></i>
    </div>
    <div class="job-info" style="flex:1;min-width:180px;">
      ${desc}
      <div class="job-meta" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px;">
        ${specialty}${isUrgent}
        <span style="font-size:0.8rem;color:var(--gray);">${meta}</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="job-status ${statusCss}">${statusTxt}</span>
      ${actions}
    </div>
  </div>`;
}

function escHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
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

export async function rejectJob(jobId) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ status: 'rechazado' }).eq('id', jobId);
  if (!error) {
    showToast('Trabajo rechazado.', 'info');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function startJob(jobId) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ status: 'en_proceso' }).eq('id', jobId);
  if (!error) {
    showToast('¡Trabajo iniciado!', 'success');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function finishJob(jobId) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ status: 'finalizado' }).eq('id', jobId);
  if (!error) {
    showToast('¡Trabajo finalizado! El cliente podrá calificarte.', 'success');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function cancelJob(jobId) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ status: 'cancelado' }).eq('id', jobId);
  if (!error) {
    showToast('Trabajo cancelado.', 'info');
    const { loadUserDashboard } = await import('./dashboard.js');
    loadUserDashboard();
  } else showToast('Error: ' + error.message, 'error');
}
