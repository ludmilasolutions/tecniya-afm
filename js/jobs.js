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

  const sb       = getSupabase();
  const desc     = document.getElementById('job-req-desc')?.value.trim();
  const address  = document.getElementById('job-req-address')?.value.trim();
  const isUrgent = document.getElementById('job-req-urgent')?.checked || false;
  const errorEl  = document.getElementById('job-req-error');

  if (!desc) {
    if (errorEl) { errorEl.textContent = 'Describí el trabajo.'; errorEl.classList.remove('hidden'); }
    return;
  }

  // Resolver professional_id
  const proAction = store.currentProIdForAction;
  let professionalProfileId = proAction?.userProfileId || null;
  if (!professionalProfileId) {
    const pro = store.allProfessionals?.find(x => x.id == proAction?.proId);
    professionalProfileId = pro?.user_id || null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (professionalProfileId && !uuidRegex.test(professionalProfileId)) professionalProfileId = null;

  // Recolectar slots de agenda
  const slots = [1,2,3].map(i => {
    const date = document.getElementById(`job-req-date-${i}`)?.value;
    const period = document.getElementById(`job-req-period-${i}`)?.value;
    return date ? { date, period } : null;
  }).filter(Boolean);

  const btn = document.getElementById('btn-submit-job');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="opacity:.7">Enviando...</span>'; }

  // Subir foto si hay una adjunta
  let photoUrl = null;
  const photoFile = document.getElementById('job-req-photo')?.files?.[0];
  if (photoFile && professionalProfileId) {
    const ext  = photoFile.name.split('.').pop();
    const path = `job-requests/${store.currentUser.id}/${Date.now()}.${ext}`;
    const { data: up } = await sb.storage.from('work-photos').upload(path, photoFile, { upsert: true });
    if (up) {
      const { data: { publicUrl } } = sb.storage.from('work-photos').getPublicUrl(path);
      photoUrl = publicUrl;
    }
  }

  const jobPayload = {
    user_id:         store.currentUser.id,
    professional_id: professionalProfileId,
    specialty:       document.getElementById('job-req-specialty')?.value || 'General',
    description:     desc,
    address,
    is_urgent:       isUrgent,
    proposed_dates:  slots,
    photo_url:       photoUrl,
    status:          'solicitado',
    created_at:      new Date().toISOString()
  };

  const { data, error } = await sb.from('jobs').insert(jobPayload).select();

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane"></i>Enviar solicitud'; }

  if (error) {
    console.error('job insert:', error);
    if (errorEl) { errorEl.textContent = error.message; errorEl.classList.remove('hidden'); }
    return;
  }

  // Limpiar form
  ['job-req-desc','job-req-address'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  [1,2,3].forEach(i => { const el = document.getElementById(`job-req-date-${i}`); if(el) el.value=''; });
  const prev = document.getElementById('job-req-photo-preview');
  if (prev) { prev.src=''; prev.style.display='none'; }
  const pname = document.getElementById('job-req-photo-name');
  if (pname) pname.textContent = '';

  closeModal('modal-request-job');
  showToast('¡Solicitud enviada! El profesional elegirá una fecha.', 'success');
}

// Preview foto adjunta
export function previewJobPhoto(input) {
  const file = input.files?.[0];
  const nameEl = document.getElementById('job-req-photo-name');
  const prev   = document.getElementById('job-req-photo-preview');
  if (!file) return;
  if (nameEl) nameEl.textContent = file.name;
  if (prev) {
    prev.src = URL.createObjectURL(file);
    prev.style.display = 'block';
  }
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
  solicitado:             'status-solicitado',
  aceptado:               'status-aceptado',
  en_proceso:             'status-en-proceso',
  pendiente_confirmacion: 'status-aceptado',
  finalizado:             'status-finalizado',
  cancelado:              'status-cancelado',
  rechazado:              'status-cancelado',
  en_disputa:             'status-solicitado'
};
const STATUS_LABEL = {
  solicitado:             'Nuevo',
  aceptado:               'Aceptado',
  en_proceso:             'En proceso',
  pendiente_confirmacion: 'Esperando confirmación',
  finalizado:             'Finalizado',
  cancelado:              'Cancelado',
  rechazado:              'Rechazado',
  en_disputa:             'En disputa'
};
const STATUS_ICON = {
  solicitado:             'fa-clock',
  aceptado:               'fa-check',
  en_proceso:             'fa-gears',
  pendiente_confirmacion: 'fa-hourglass-half',
  finalizado:             'fa-check-circle',
  cancelado:              'fa-times-circle',
  rechazado:              'fa-times-circle',
  en_disputa:             'fa-triangle-exclamation'
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

  // Fecha confirmada
  let confirmedDateBadge = '';
  if (j.confirmed_date) {
    try {
      const cd = new Date(j.confirmed_date);
      const fmt = cd.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'});
      confirmedDateBadge = `<span style="font-size:0.78rem;background:rgba(6,182,212,0.12);color:var(--accent);padding:2px 8px;border-radius:20px;"><i class="fa fa-calendar-check" style="margin-right:4px;"></i>${fmt} — ${j.confirmed_period||''}</span>`;
    } catch {}
  }

  // Foto adjunta
  const photoBtn = j.photo_url
    ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${j.photo_url}','_blank')" title="Ver foto adjunta"><i class="fa fa-image"></i></button>`
    : '';

  // Acciones según rol y estado
  let actions = '';
  if (viewAs === 'pro') {
    if (j.status === 'solicitado') {
      actions = `
        ${j.proposed_dates?.length ? `<span style="font-size:0.75rem;color:var(--accent);"><i class="fa fa-calendar"></i> ${j.proposed_dates.length} fecha${j.proposed_dates.length>1?'s':''}</span>` : ''}
        <button class="btn btn-success btn-sm" onclick="window.acceptJob('${j.id}')"><i class="fa fa-check"></i>Aceptar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.rejectJob('${j.id}')"><i class="fa fa-times"></i>Rechazar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>
        ${photoBtn}`;
    } else if (j.status === 'aceptado') {
      actions = `
        <button class="btn btn-primary btn-sm" onclick="window.startJob('${j.id}')"><i class="fa fa-play"></i>Iniciar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'en_proceso') {
      actions = `
        <button class="btn btn-success btn-sm" onclick="window.finishJob('${j.id}')"><i class="fa fa-flag-checkered"></i>Marcar terminado</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'pendiente_confirmacion') {
      actions = `<span style="font-size:0.82rem;color:var(--gray);">Esperando que el cliente confirme...</span>`;
    }
  } else if (viewAs === 'user') {
    if (['solicitado','aceptado','en_proceso'].includes(j.status)) {
      actions = `
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.professional_id}')"><i class="fa fa-comments"></i>Chat</button>
        <button class="btn btn-ghost btn-sm" onclick="window.cancelJob('${j.id}')"><i class="fa fa-times"></i>Cancelar</button>`;
    } else if (j.status === 'pendiente_confirmacion') {
      actions = `
        <button class="btn btn-success btn-sm" onclick="window.openConfirmFinish('${j.id}')"><i class="fa fa-check-double"></i>Confirmar cierre</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.professional_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'finalizado') {
      const ratingBtn = j.client_confirmed
        ? `<button class="btn btn-orange btn-sm" onclick="window.openRatingModal('${j.professional_id}','${j.id}')"><i class="fa fa-star"></i>Calificar</button>`
        : '';
      actions = `
        ${ratingBtn}
        <button class="btn btn-ghost btn-sm" onclick="window.reHireJob('${j.professional_id}','${j.pro_name||'Profesional'}','${j.professional_id}')"><i class="fa fa-rotate-right"></i>Volver a contratar</button>`;
    }
  }

  return `<div class="job-item" style="flex-wrap:wrap;gap:10px;padding:16px;">
    <div class="job-icon" style="background:rgba(79,70,229,0.1);color:var(--primary);flex-shrink:0;">
      <i class="fa ${statusIcon}"></i>
    </div>
    <div class="job-info" style="flex:1;min-width:180px;">
      ${desc}
      <div class="job-meta" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px;">
        ${specialty}${isUrgent}${confirmedDateBadge}
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
  const { data: job } = await sb.from('jobs').select('proposed_dates').eq('id', jobId).maybeSingle();

  if (job?.proposed_dates?.length) {
    store._acceptingJobId = jobId;
    renderDatePickerModal(job.proposed_dates, jobId);
    return;
  }
  // Sin slots: aceptar directo
  const { error } = await sb.from('jobs').update({ status: 'aceptado' }).eq('id', jobId);
  if (!error) {
    showToast('Trabajo aceptado', 'success');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

function renderDatePickerModal(slots, jobId) {
  let modal = document.getElementById('modal-pick-date');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-pick-date';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const fmtSlot = s => {
    try {
      const d = new Date(s.date);
      return `${d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})} — ${s.period}`;
    } catch { return s.date + ' — ' + s.period; }
  };
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-calendar-check" style="color:var(--accent);margin-right:8px;"></i>Elegí una fecha</div>
      </div>
      <div class="modal-body">
        <p style="color:var(--gray);font-size:0.88rem;margin-bottom:16px;">El cliente propuso estas opciones:</p>
        <div style="display:grid;gap:10px;margin-bottom:20px;">
          ${slots.map(s => `
            <button onclick="window.confirmJobDate('${jobId}','${s.date}','${s.period}')"
              style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:14px 18px;text-align:left;cursor:pointer;color:var(--light);transition:border-color .2s;"
              onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
              <i class="fa fa-clock" style="color:var(--accent);margin-right:8px;"></i>${fmtSlot(s)}
            </button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-block" onclick="document.getElementById('modal-pick-date').style.display='none'">Cancelar</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

export async function confirmJobDate(jobId, date, period) {
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({
    status:           'aceptado',
    confirmed_date:   date,
    confirmed_period: period
  }).eq('id', jobId);
  const modal = document.getElementById('modal-pick-date');
  if (modal) modal.style.display = 'none';
  if (!error) {
    try {
      const d = new Date(date);
      const fmt = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
      showToast(`Trabajo aceptado para el ${fmt} — ${period}`, 'success');
    } catch { showToast('Trabajo aceptado', 'success'); }
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
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
  // El pro marca "terminado" → espera confirmación del cliente
  const { error } = await sb.from('jobs').update({ status: 'pendiente_confirmacion' }).eq('id', jobId);
  if (!error) {
    showToast('Marcaste el trabajo como terminado. Esperando confirmación del cliente.', 'success');
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function clientConfirmFinish(confirmed) {
  const jobId = store._confirmingJobId;
  if (!jobId) return;
  const sb = getSupabase();
  const comment = document.getElementById('confirm-finish-comment')?.value.trim();

  if (confirmed) {
    const { error } = await sb.from('jobs').update({
      status: 'finalizado',
      client_confirmed: true,
      client_comment: comment || null
    }).eq('id', jobId);

    closeModal('modal-confirm-finish');
    if (!error) {
      showToast('¡Trabajo confirmado! Podés calificar al profesional.', 'success');
      store._confirmingJobId = null;
      const { loadUserDashboard } = await import('./dashboard.js');
      await loadUserDashboard();
      // Abrir modal de calificación automáticamente
      const { data: job } = await sb.from('jobs').select('professional_id').eq('id', jobId).maybeSingle();
      if (job?.professional_id) {
        setTimeout(() => openRatingModal(job.professional_id, jobId), 600);
      }
    }
  } else {
    // Abrir modal de disputa
    closeModal('modal-confirm-finish');
    store._disputeJobId = jobId;
    const disputeId = document.getElementById('dispute-job-id');
    if (disputeId) disputeId.textContent = jobId;
    showModal('modal-dispute');
  }
}

export async function submitDispute() {
  const jobId = store._disputeJobId;
  const desc  = document.getElementById('dispute-desc')?.value.trim();
  if (!jobId || !desc) { showToast('Describí el problema.', 'error'); return; }
  const sb = getSupabase();
  await sb.from('jobs').update({ status: 'en_disputa', dispute_desc: desc }).eq('id', jobId);
  closeModal('modal-dispute');
  showToast('Reporte enviado. El equipo de TECNIYA se va a comunicar.', 'info');
  store._disputeJobId = null;
  const { loadUserDashboard } = await import('./dashboard.js');
  loadUserDashboard();
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

// FEATURE 5 — Volver a contratar desde historial
export function reHireJob(proUserId, proName, proId) {
  openJobRequest(proId, proName, proUserId);
}
