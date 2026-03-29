import { store } from './store.js';
import { onProCancelJob, onUserCancelJob } from './penalties.js';
import { checkRequestLimit, isSpamMessage } from './security.js';
import { getSupabase } from './supabase.js';
import { showModal, closeModal, showToast } from './ui.js';
import { formatDate } from './utils.js';

export function openJobRequest(proId, proName, proUserId) {
  if (!store.currentUser) {
    showModal('modal-login');
    showToast('Iniciá sesión para solicitar trabajos', 'info');
    return;
  }
  const resolvedUserId = proUserId || store.allProfessionals?.find(x => x.id == proId)?.user_id;
  if (resolvedUserId && resolvedUserId === store.currentUser.id) {
    showToast('No podés enviarte trabajos a vos mismo.', 'warning');
    return;
  }
  // Resetear selección (solicitud simple a 1 pro)
  store.selectedPros = [{ proId, name: proName, userProfileId: resolvedUserId || proId }];
  store.setCurrentProIdForAction({ proId, userProfileId: resolvedUserId || proId });
  const proNameEl = document.getElementById('job-req-pro-name');
  if (proNameEl) proNameEl.textContent = proName;
  // No mostrar barra — openJobRequest es solicitud directa a 1 pro
  showModal('modal-request-job');
}

export function toggleProSelection(proId, proName, proUserId) {
  if (!store.currentUser) { showModal('modal-login'); return; }
  const resolvedUserId = proUserId || store.allProfessionals?.find(x => x.id == proId)?.user_id;
  if (resolvedUserId === store.currentUser.id) {
    showToast('No podés enviarte trabajos a vos mismo.', 'warning'); return;
  }
  const idx = store.selectedPros.findIndex(p => p.proId == proId);
  if (idx >= 0) {
    store.selectedPros.splice(idx, 1);
    showToast(`${proName} quitado de la selección`, 'info');
  } else {
    if (store.selectedPros.length >= store.MAX_MULTI_REQUEST) {
      showToast(`Máximo ${store.MAX_MULTI_REQUEST} profesionales por solicitud`, 'warning'); return;
    }
    store.selectedPros.push({ proId, name: proName, userProfileId: resolvedUserId || proId });
    showToast(`${proName} agregado (${store.selectedPros.length}/${store.MAX_MULTI_REQUEST})`, 'success');
  }
  updateMultiProBadge();
  updateProCardSelection();
}

export function updateMultiProBadge() {
  const n = store.selectedPros.length;
  const bar = document.getElementById('multi-request-bar');
  if (!bar) return;
  // La barra solo aparece cuando hay 2 o más pros seleccionados con el botón +
  if (n < 2) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex'; bar.style.alignItems = 'center';
  const names = store.selectedPros.map(p => p.name).join(', ');
  const label = document.getElementById('multi-req-label');
  const btn   = document.getElementById('multi-req-send-btn');
  if (label) label.textContent = `${n} profesional${n > 1 ? 'es' : ''} seleccionado${n > 1 ? 's' : ''}: ${names}`;
  if (btn)   btn.textContent   = n === 1 ? 'Enviar solicitud' : `Enviar a ${n} profesionales`;
}

export function updateProCardSelection() {
  const selectedIds = new Set(store.selectedPros.map(p => String(p.proId)));
  document.querySelectorAll('[data-pro-id]').forEach(card => {
    const isSelected = selectedIds.has(card.dataset.proId);
    card.style.outline = isSelected ? '2px solid var(--accent)' : '';
    card.style.boxShadow = isSelected ? '0 0 0 3px rgba(6,182,212,0.2)' : '';
  });
}

export function openMultiRequest() {
  if (!store.selectedPros.length) return;
  // Usar el primer pro como referencia para el form
  const first = store.selectedPros[0];
  store.setCurrentProIdForAction(first);
  const proNameEl = document.getElementById('job-req-pro-name');
  if (proNameEl) {
    const n = store.selectedPros.length;
    proNameEl.textContent = n === 1
      ? first.name
      : `${first.name} y ${n - 1} profesional${n > 2 ? 'es' : ''} más`;
  }
  showModal('modal-request-job');
}

export async function submitJobRequest() {
  // Verificar límite diario
  const limitCheck = await checkRequestLimit();
  if (!limitCheck.allowed) {
    showToast(limitCheck.reason || 'Límite diario alcanzado', 'warning');
    return;
  }

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

  // Determinar targets (multi o simple)
  const targets = store.selectedPros.length > 1
    ? store.selectedPros
    : [{ userProfileId: professionalProfileId }];

  const isMulti = targets.length > 1;
  const groupId = isMulti ? crypto.randomUUID() : null;
  const uuidRegex2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let sent = 0;
  let lastError = null;
  for (const target of targets) {
    const pid = target.userProfileId;
    if (!pid || !uuidRegex2.test(pid)) continue;
    const payload = { ...jobPayload,
      professional_id:  pid,
      multiple_request: isMulti,
      group_id:         groupId
    };
    const { error: e } = await sb.from('jobs').insert(payload);
    if (!e) {
      sent++;
      import('./notifications.js').then(m => m.createNotification(
        pid, 'job_request', 'Nueva solicitud de trabajo',
        `${desc.substring(0, 80)}${desc.length > 80 ? '...' : ''}`
      ));
    } else {
      lastError = e;
      console.error('job insert error:', e);
    }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane"></i>Enviar solicitud'; }

  if (sent === 0) {
    if (errorEl) { errorEl.textContent = lastError?.message || 'No se pudo enviar la solicitud.'; errorEl.classList.remove('hidden'); }
    return;
  }

  // Limpiar form
  ['job-req-desc','job-req-address'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  [1,2,3].forEach(i => { const el = document.getElementById(`job-req-date-${i}`); if(el) el.value=''; });
  const prev = document.getElementById('job-req-photo-preview');
  if (prev) { prev.src=''; prev.style.display='none'; }
  const pname = document.getElementById('job-req-photo-name');
  if (pname) pname.textContent = '';

  store.selectedPros = [];
  updateMultiProBadge();

  closeModal('modal-request-job');
  const msg = sent > 1
    ? `¡Solicitud enviada a ${sent} profesionales! El primero que acepte queda asignado.`
    : '¡Solicitud enviada! El profesional elegirá una fecha.';
  showToast(msg, 'success');
}

// Preview foto adjunta
let jobPhotoObjectURL = null;

export function previewJobPhoto(input) {
  const file = input.files?.[0];
  const nameEl = document.getElementById('job-req-photo-name');
  const prev   = document.getElementById('job-req-photo-preview');
  if (!file) return;
  
  // Liberar URL anterior para evitar memory leak
  if (jobPhotoObjectURL) {
    URL.revokeObjectURL(jobPhotoObjectURL);
  }
  
  jobPhotoObjectURL = URL.createObjectURL(file);
  if (nameEl) nameEl.textContent = file.name;
  if (prev) {
    prev.src = jobPhotoObjectURL;
    prev.style.display = 'block';
  }
}

export async function loadUserJobs() {
  if (!store.currentUser) return [];
  
  const sb = getSupabase();
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30*24*3600*1000).toISOString();
    const { data } = await sb.from('jobs').select('*')
      .eq('user_id', store.currentUser.id)
      .or(`status.not.in.(cancelado,rechazado),created_at.gt.${thirtyDaysAgo}`);
    return data || [];
  } catch (e) {
    console.warn('loadUserJobs:', e?.message);
    return [];
  }
}

export async function loadProJobs() {
  if (!store.currentPro) return [];
  
  const sb = getSupabase();
  try {
    const { data } = await sb.from('jobs').select('*').eq('professional_id', store.currentPro.id);
    return data || [];
  } catch (e) {
    console.warn('loadProJobs:', e?.message);
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
  en_disputa:             'status-solicitado',
  fecha_propuesta_pro:    'status-aceptado'
};
const STATUS_LABEL = {
  solicitado:             'Nuevo',
  aceptado:               'Aceptado',
  en_proceso:             'En proceso',
  pendiente_confirmacion: 'Esperando confirmación',
  finalizado:             'Finalizado',
  cancelado:              'Cancelado',
  rechazado:              'Rechazado',
  en_disputa:             'En disputa',
  fecha_propuesta_pro:    'Fecha propuesta'
};
const STATUS_ICON = {
  solicitado:             'fa-clock',
  aceptado:               'fa-check',
  en_proceso:             'fa-gears',
  pendiente_confirmacion: 'fa-hourglass-half',
  finalizado:             'fa-check-circle',
  cancelado:              'fa-times-circle',
  rechazado:              'fa-times-circle',
  en_disputa:             'fa-triangle-exclamation',
  fecha_propuesta_pro:    'fa-calendar-plus'
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
    } catch (e) {
      console.warn('Error formatting confirmed_date:', e?.message);
    }
  }

  // Badge check-in
  let checkinBadge = '';
  if (j.checked_in_at) {
    const fmt = new Date(j.checked_in_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    checkinBadge = `<span style="font-size:0.78rem;background:rgba(16,185,129,0.12);color:#10b981;padding:2px 8px;border-radius:20px;"><i class="fa fa-location-dot" style="margin-right:4px;"></i>Check-in ${fmt}</span>`;
  }

  // Foto adjunta
  const photoBtn = j.photo_url
    ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${j.photo_url}','_blank')" title="Ver foto adjunta"><i class="fa fa-image"></i></button>`
    : '';

  // Acciones según rol y estado
  let actions = '';
  // ── Alerta de expiración (solicitado sin respuesta > EXPIRE_HRS horas) ──────
  const EXPIRE_HRS = 12;
  let expiryWarning = '';
  if (j.status === 'solicitado' && j.created_at) {
    const hoursOld = (Date.now() - new Date(j.created_at).getTime()) / 36e5;
    if (hoursOld >= EXPIRE_HRS) {
      expiryWarning = `<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#f59e0b;margin-bottom:6px;padding:6px 10px;background:rgba(245,158,11,0.08);border-radius:8px;width:100%;">
        <i class="fa fa-clock"></i> Sin respuesta hace más de ${Math.floor(hoursOld)}h — podés cancelar y buscar otro profesional.
      </div>`;
    } else if (hoursOld >= EXPIRE_HRS / 2) {
      const remaining = Math.max(1, Math.ceil(EXPIRE_HRS - hoursOld));
      expiryWarning = `<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--gray);margin-bottom:6px;width:100%;">
        <i class="fa fa-hourglass-half"></i> Esperando respuesta — ${remaining}h para alerta.
      </div>`;
    }
  }

  if (viewAs === 'pro') {
    if (j.status === 'solicitado') {
      actions = `
        ${expiryWarning}
        ${j.proposed_dates?.length ? `<span style="font-size:0.75rem;color:var(--accent);"><i class="fa fa-calendar"></i> ${j.proposed_dates.length} fecha${j.proposed_dates.length>1?'s':''}</span>` : ''}
        ${photoBtn}
        <button class="btn btn-success btn-sm" onclick="window.acceptJob('${j.id}')"><i class="fa fa-check"></i>Aceptar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openProposeDateModal('${j.id}')"><i class="fa fa-calendar-plus"></i>Otra fecha</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openRejectModal('${j.id}')"><i class="fa fa-times"></i>Rechazar</button>`;
    } else if (j.status === 'aceptado') {
      actions = `
        <button class="btn btn-primary btn-sm" onclick="window.startJob('${j.id}')"><i class="fa fa-play"></i>Iniciar</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'en_proceso') {
      actions = `
        <button class="btn btn-success btn-sm" onclick="window.finishJob('${j.id}')"><i class="fa fa-flag-checkered"></i>Marcar terminado</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.user_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'pendiente_confirmacion') {
      actions = `<span style="font-size:0.82rem;color:var(--gray);"><i class="fa fa-hourglass-half"></i> Esperando confirmación del cliente...</span>`;
    }
  } else if (viewAs === 'user') {
    if (j.status === 'fecha_propuesta_pro') {
      // El pro propuso una fecha alternativa
      const slot = j.pro_proposed_dates?.[0];
      let slotStr = '';
      if (slot) try {
        const d = new Date(slot.date);
        slotStr = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'}) + ' — ' + slot.period;
      } catch (e) {
        console.warn('Error formatting pro_proposed_dates:', e?.message);
      }
      actions = `
        <div style="width:100%;font-size:0.82rem;color:var(--light);background:rgba(79,70,229,0.08);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
          <i class="fa fa-calendar-plus" style="color:var(--accent);margin-right:6px;"></i>
          El profesional propone: <strong>${slotStr}</strong>
        </div>
        <button class="btn btn-success btn-sm" onclick="window.approveProDate('${j.id}')"><i class="fa fa-check"></i>Aceptar fecha</button>
        <button class="btn btn-ghost btn-sm" onclick="window.rejectProDate('${j.id}')"><i class="fa fa-times"></i>Rechazar</button>`;
    } else if (j.status === 'solicitado') {
      // Puede cancelar mientras espera respuesta — siempre disponible
      actions = `
        ${expiryWarning}
        ${j.professional_id ? `<button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.professional_id}','${j.id}',true)" style="font-size:0.78rem;"><i class="fa fa-comment-dots"></i>Consultar</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="window.openCancelModal('${j.id}','solicitado')"><i class="fa fa-times"></i>Cancelar solicitud</button>`;
    } else if (['aceptado','en_proceso'].includes(j.status)) {
      actions = `
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.professional_id}')"><i class="fa fa-comments"></i>Chat</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openCancelModal('${j.id}','activo')"><i class="fa fa-times"></i>Cancelar</button>`;
    } else if (j.status === 'pendiente_confirmacion') {
      actions = `
        <button class="btn btn-success btn-sm" onclick="window.openConfirmFinish('${j.id}')"><i class="fa fa-check-double"></i>Confirmar cierre</button>
        <button class="btn btn-ghost btn-sm" onclick="window.openChatWith('${j.professional_id}')"><i class="fa fa-comments"></i>Chat</button>`;
    } else if (j.status === 'finalizado') {
      const ratingBtn = j.client_confirmed
        ? `<button class="btn btn-orange btn-sm" onclick="window.openRatingModal('${j.professional_id}','${j.id}')"><i class="fa fa-star"></i>Calificar</button>`
        : '';
      // Garantía activa si warranty_until es futuro
      const warrantyActive = j.warranty_until && new Date(j.warranty_until) > new Date();
      const warrantyBtn = warrantyActive
        ? `<button class="btn btn-ghost btn-sm" onclick="window.openWarrantyReport('${j.id}')" title="Reportar problema dentro de garantía" style="color:#f59e0b;"><i class="fa fa-shield-halved"></i>Garantía</button>`
        : '';
      actions = `
        ${ratingBtn}
        ${warrantyBtn}
        <button class="btn btn-ghost btn-sm" onclick="window.reHireJob('${j.professional_id}','${j.pro_name||'Profesional'}','${j.professional_id}')"><i class="fa fa-rotate-right"></i>Volver a contratar</button>`;
    } else if (['cancelado','rechazado'].includes(j.status)) {
      // Motivo: solo mostrar si fue cancelación del cliente (no rechazo del pro)
      const mostrarMotivo = j.status === 'cancelado' && j.cancel_reason;
      const motivo = mostrarMotivo
        ? `<span style="font-size:0.78rem;color:var(--gray);font-style:italic;">"${escHtml(j.cancel_reason)}"</span>`
        : '';
      actions = `
        ${motivo}
        <button class="btn btn-ghost btn-sm" onclick="window.reHireJob('${j.professional_id}','','${j.professional_id}')"><i class="fa fa-rotate-right"></i>Buscar otro</button>`;
    }
  }

  const categoryLabel = j.specialty
    ? `<span class="job-cat">${escHtml(j.specialty)}</span><span class="job-meta-dot"></span>`
    : '';
  const urgentBadge = j.is_urgent
    ? `<span style="font-size:0.72rem;background:rgba(239,68,68,0.13);color:#ef4444;padding:2px 7px;border-radius:20px;"><i class="fa fa-bolt"></i> Urgente</span>`
    : '';

  return `<div class="job-item">
    <div class="job-item-top">
      <div class="job-title">${escHtml(j.description || 'Trabajo sin título')}</div>
      <span class="job-status ${statusCss}">${statusTxt}</span>
    </div>
    <div class="job-meta">
      ${categoryLabel}
      ${urgentBadge}
      <span class="job-date-str">${dateStr}</span>
      ${confirmedDateBadge}${checkinBadge}
    </div>
    <div class="job-actions">
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
    // Notificar a los pros del grupo que el trabajo ya fue asignado
    try {
      const sbLocal = getSupabase();
      const { data: jb } = await sbLocal.from('jobs').select('group_id').eq('id', jobId).maybeSingle();
      if (jb?.group_id) {
        const { data: siblings } = await sbLocal.from('jobs')
          .select('professional_id').eq('group_id', jb.group_id).neq('id', jobId);
        for (const s of siblings || []) {
          if (s.professional_id) {
            import('./notifications.js').then(m => m.createNotification(
              s.professional_id, 'job_rejected',
              'Trabajo ya asignado a otro profesional',
              'Otro profesional aceptó esta solicitud antes. La solicitud fue cancelada automáticamente.'
            ));
          }
        }
      }
    } catch (e) {
      console.warn('Error sending rejection notifications:', e?.message);
    }
    // Desbloquear chat: pre_acceptance = false
    try {
      const sbLocal = getSupabase();
      await sbLocal.from('conversations').update({ pre_acceptance: false })
        .eq('job_id', jobId);
    } catch (e) {
      console.warn('Error updating conversation:', e?.message);
    }
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
    } catch (e) {
      console.warn('Error formatting slot date:', e?.message);
      return s.date + ' — ' + s.period;
    }
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
      // Notificar al cliente
      const { data: job } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
      if (job?.user_id) {
        import('./notifications.js').then(m => m.createNotification(
          job.user_id, 'job_accepted',
          '¡Tu solicitud fue aceptada!',
          `El profesional confirmó para el ${fmt} — ${period}`
        ));
      }
    } catch (e) { 
      console.warn('Error sending job_accepted notification:', e?.message);
      showToast('Trabajo aceptado', 'success'); 
    }
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
  // Buscar el profesional en la lista o usar el ID directamente
  let userProfileId = null;
  const pro = store.allProfessionals?.find(x => x.id == proId || x.id === proId || x.user_id === proId);
  if (pro?.user_id) {
    userProfileId = pro.user_id;
  } else {
    // proId puede ser directamente el profile id (cuando viene de clientConfirmFinish)
    userProfileId = proId;
  }
  
  store.setCurrentProIdForAction({ proId, jobId, userProfileId });
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
  let professionalProfileId = store.currentProIdForAction.userProfileId;
  
  // Si no hay userProfileId, intentar buscar en allProfessionals
  if (!professionalProfileId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pro = store.allProfessionals?.find(x => String(x.id) === String(proId) || x.id == proId);
    if (pro?.user_id && uuidRegex.test(pro.user_id)) {
      professionalProfileId = pro.user_id;
    }
  }

  if (!professionalProfileId) {
    // proId puede ser el user_id (profiles.id) directamente
    // Intentar buscar en professionals por user_id primero
    const { data: proData } = await sb.from('professionals').select('user_id').eq('user_id', proId).maybeSingle();
    if (proData?.user_id) {
      professionalProfileId = proData.user_id;
    } else {
      // Fallback: intentar por id de la tabla professionals
      const { data: proData2 } = await sb.from('professionals').select('user_id').eq('id', proId).maybeSingle();
      if (proData2?.user_id) {
        professionalProfileId = proData2.user_id;
      } else {
        // proId ya es directamente el profile id
        professionalProfileId = proId;
      }
    }
  }

  if (!professionalProfileId) {
    showToast('No se puede calificar este profesional', 'info');
    closeModal('modal-rating');
    return;
  }

  if (!professionalProfileId) {
    showToast('No se puede calificar este profesional', 'info');
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

export async function rejectJob() {
  const jobId  = store._rejectJobId;
  const reason = document.getElementById('reject-reason')?.value.trim();
  if (!jobId) return;
  const sb = getSupabase();
  const { data: job } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
  const { error } = await sb.from('jobs').update({
    status:        'rechazado',
    cancel_reason: reason || null
  }).eq('id', jobId);
  if (!error) {
    closeModal('modal-reject-job');
    showToast('Solicitud rechazada.', 'info');
    if (job?.user_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.user_id, 'job_rejected',
        'Tu solicitud no fue aceptada',
        reason || 'El profesional no está disponible. Podés buscar otro.'
      ));
    }
    store._rejectJobId = null;
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function startJob(jobId) {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { error } = await sb.from('jobs').update({
    status:         'en_proceso',
    checked_in_at:  now
  }).eq('id', jobId);

  if (!error) {
    // Mensaje de sistema en el chat
    try {
      const { data: conv } = await sb.from('conversations')
        .select('id').or(`and(participant_one.eq.${store.currentPro.id},participant_two.neq.${store.currentPro.id}),and(participant_two.eq.${store.currentPro.id},participant_one.neq.${store.currentPro.id})`)
        .maybeSingle();
      // Notificar al cliente
      const { data: job } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
      if (job?.user_id) {
        import('./notifications.js').then(m => m.createNotification(
          job.user_id, 'job_started',
          '¡El profesional llegó y empezó el trabajo!',
          'Podés seguir el progreso desde tu panel.'
        ));
      }
    } catch (e) {
      console.warn('Error in startJob notifications:', e?.message);
    }
    const fmt = new Date(now).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    showToast(`Check-in registrado a las ${fmt}. ¡Éxito con el trabajo!`, 'success');
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
    const { data: job } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
    if (job?.user_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.user_id, 'job_finished', 'El profesional terminó el trabajo',
        'Revisá el trabajo y confirmá el cierre desde tu panel.'
      ));
    }
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

// Abrir modal de cancelación (cliente)
export function openCancelModal(jobId, context) {
  store._cancelJobId     = jobId;
  store._cancelContext   = context; // 'solicitado' | 'activo'
  const title = document.getElementById('cancel-modal-title');
  const hint  = document.getElementById('cancel-modal-hint');
  if (title) title.textContent = context === 'solicitado' ? 'Cancelar solicitud' : 'Cancelar trabajo';
  if (hint)  hint.textContent  = context === 'solicitado'
    ? 'El profesional será notificado. Tu solicitud quedará registrada como cancelada.'
    : 'El profesional será notificado. Esta acción no se puede deshacer.';
  const el = document.getElementById('cancel-reason');
  if (el) el.value = '';
  showModal('modal-cancel-job');
}

export async function cancelJob() {
  const jobId  = store._cancelJobId;
  const reason = document.getElementById('cancel-reason')?.value.trim();
  if (!jobId) return;
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({
    status:        'cancelado',
    cancel_reason: reason || null
  }).eq('id', jobId);
  if (!error) {
    closeModal('modal-cancel-job');
    showToast('Solicitud cancelada.', 'info');
    // Notificar al profesional si ya había uno asignado
    const { data: job } = await sb.from('jobs').select('professional_id,description').eq('id', jobId).maybeSingle();
    if (job?.professional_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.professional_id, 'job_rejected',
        'Solicitud cancelada por el cliente',
        reason || 'El cliente canceló la solicitud.'
      ));
    }
    store._cancelJobId = null;
    const { loadUserDashboard } = await import('./dashboard.js');
    loadUserDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

// Abrir modal de rechazo (pro)
export function openRejectModal(jobId) {
  store._rejectJobId = jobId;
  const el = document.getElementById('reject-reason');
  if (el) el.value = '';
  showModal('modal-reject-job');
}

// FEATURE 5 — Volver a contratar desde historial
export function reHireJob(proUserId, proName, proId) {
  openJobRequest(proId, proName, proUserId);
}

// ─── FECHA ALTERNATIVA DEL PRO ────────────────────────────────────────────────

export function openProposeDateModal(jobId) {
  store._proposeDateJobId = jobId;
  const el = document.getElementById('pro-date-input');
  if (el) el.value = '';
  const sel = document.getElementById('pro-period-input');
  if (sel) sel.value = 'mañana';
  showModal('modal-propose-date');
}

export async function submitProposedDate() {
  const jobId  = store._proposeDateJobId;
  const date   = document.getElementById('pro-date-input')?.value;
  const period = document.getElementById('pro-period-input')?.value || 'flexible';
  if (!jobId || !date) { showToast('Elegí una fecha.', 'error'); return; }

  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({
    status:             'fecha_propuesta_pro',
    pro_proposed_dates: [{ date, period }]
  }).eq('id', jobId);

  if (!error) {
    closeModal('modal-propose-date');
    showToast('Fecha alternativa enviada al cliente.', 'success');
    const { data: job } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
    if (job?.user_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.user_id, 'job_request',
        'El profesional propone otra fecha',
        'Revisá la nueva propuesta y confirmá o rechazala desde tu panel.'
      ));
    }
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function approveProDate(jobId) {
  const sb = getSupabase();
  const { data: job } = await sb.from('jobs').select('pro_proposed_dates').eq('id', jobId).maybeSingle();
  const slot = job?.pro_proposed_dates?.[0];
  if (!slot) return;
  const { error } = await sb.from('jobs').update({
    status:           'aceptado',
    confirmed_date:   slot.date,
    confirmed_period: slot.period
  }).eq('id', jobId);
  if (!error) {
    try {
      const d = new Date(slot.date);
      const fmt = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
      showToast(`Fecha confirmada: ${fmt} — ${slot.period}`, 'success');
    } catch (e) { 
      console.warn('Error formatting confirmed date:', e?.message);
      showToast('Fecha confirmada.', 'success'); 
    }
    const { loadUserDashboard } = await import('./dashboard.js');
    loadUserDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

export async function rejectProDate(jobId) {
  // Cliente rechaza la fecha del pro → vuelve a solicitado para que el pro elija otra o rechace
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({
    status: 'solicitado',
    pro_proposed_dates: null
  }).eq('id', jobId);
  if (!error) {
    showToast('Fecha rechazada. El profesional fue notificado.', 'info');
    const { data: job } = await sb.from('jobs').select('professional_id').eq('id', jobId).maybeSingle();
    if (job?.professional_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.professional_id, 'job_rejected',
        'El cliente rechazó tu fecha propuesta',
        'Podés proponer otra fecha o rechazar el trabajo.'
      ));
    }
    const { loadUserDashboard } = await import('./dashboard.js');
    loadUserDashboard();
  } else showToast('Error: ' + error.message, 'error');
}

// ─── GARANTÍA POST-SERVICIO ───────────────────────────────────────────────────

export function openWarrantyReport(jobId) {
  store._warrantyJobId = jobId;
  const el = document.getElementById('warranty-desc');
  if (el) el.value = '';
  showModal('modal-warranty-report');
}

export async function submitWarrantyReport() {
  const jobId = store._warrantyJobId;
  const desc  = document.getElementById('warranty-desc')?.value.trim();
  if (!jobId || !desc) { showToast('Describí el problema.', 'error'); return; }

  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({
    status:       'en_disputa',
    dispute_desc: `[GARANTÍA] ${desc}`
  }).eq('id', jobId);

  if (!error) {
    closeModal('modal-warranty-report');
    showToast('Reporte de garantía enviado. El equipo de TECNIYA mediará en 48h.', 'info');
    // Notificar al pro
    const { data: job } = await sb.from('jobs').select('professional_id').eq('id', jobId).maybeSingle();
    if (job?.professional_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.professional_id, 'dispute',
        'Reporte de garantía recibido',
        'Un cliente reportó un problema dentro del período de garantía. El equipo de TECNIYA mediará.'
      ));
    }
    store._warrantyJobId = null;
    const { loadUserDashboard } = await import('./dashboard.js');
    loadUserDashboard();
  } else showToast('Error: ' + error.message, 'error');
}
