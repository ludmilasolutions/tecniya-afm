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

  // Obtener especialidad del pro si es posible
  let finalSpecialty = 'General';
  if (professionalProfileId) {
    const proData = store.allProfessionals?.find(p => p.user_id === professionalProfileId);
    if (proData?.specialty) finalSpecialty = proData.specialty;
    else if (proData?.categories && proData.categories.length > 0) finalSpecialty = proData.categories[0];
  }

  const jobPayload = {
    user_id:         store.currentUser.id,
    professional_id: professionalProfileId,
    specialty:       finalSpecialty,
    description:     desc,
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
  const descEl = document.getElementById('job-req-desc');
  if (descEl) descEl.value = '';
  
  const prev = document.getElementById('job-req-photo-preview');
  if (prev) { prev.src=''; prev.style.display='none'; }
  const pname = document.getElementById('job-req-photo-name');
  if (pname) pname.textContent = '';
  const pfile = document.getElementById('job-req-photo');
  if (pfile) pfile.value = '';

  store.selectedPros = [];
  updateMultiProBadge();

  closeModal('modal-request-job');
  const msg = sent > 1
    ? `¡Solicitud enviada a ${sent} profesionales! El primero que acepte queda asignado.`
    : '¡Solicitud enviada! El profesional te responderá pronto.';
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
  para_revision:          'status-aceptado',
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
  para_revision:          'Para revisión',
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
  para_revision:          'fa-hourglass-half',
  finalizado:             'fa-check-circle',
  cancelado:              'fa-times-circle',
  rechazado:              'fa-times-circle',
  en_disputa:             'fa-triangle-exclamation',
  fecha_propuesta_pro:    'fa-calendar-plus'
};

export function jobItem(j, viewAs) {
  const dateStr = j.created_at ? formatDate(j.created_at) : '';

  // ── Configuración por estado ─────────────────────────────────────────
  // Cada estado tiene: color de acento, ícono, mensaje principal para cada rol
  const STATE = {
    solicitado: {
      color: 'var(--accent)',
      bg:    'rgba(6,182,212,0.08)',
      icon:  'fa-hourglass-half',
      msgUser: 'Esperando respuesta del técnico',
      msgPro:  'Nueva solicitud de trabajo',
    },
    aceptado: {
      color: 'var(--green)',
      bg:    'rgba(16,185,129,0.08)',
      icon:  'fa-calendar-check',
      msgUser: 'Trabajo confirmado',
      msgPro:  'Trabajo aceptado — inicialo cuando llegues',
    },
    en_proceso: {
      color: 'var(--primary)',
      bg:    'rgba(79,70,229,0.08)',
      icon:  'fa-gears',
      msgUser: 'El técnico está trabajando',
      msgPro:  'En proceso — marcá como terminado cuando acabes',
    },
    pendiente_confirmacion: {
      color: 'var(--orange)',
      bg:    'rgba(249,115,22,0.10)',
      icon:  'fa-check-circle',
      msgUser: '¿Quedó listo? Confirmá el cierre del trabajo',
      msgPro:  'Esperando que el cliente confirme',
    },
    para_revision: {
      color: 'var(--orange)',
      bg:    'rgba(249,115,22,0.10)',
      icon:  'fa-check-circle',
      msgUser: '¿Quedó listo? Confirmá el cierre del trabajo',
      msgPro:  'Esperando que el cliente confirme',
    },
    fecha_propuesta_pro: {
      color: '#a855f7',
      bg:    'rgba(168,85,247,0.08)',
      icon:  'fa-calendar-plus',
      msgUser: 'El técnico propone otra fecha — respondé',
      msgPro:  'Fecha propuesta — esperando respuesta del cliente',
    },
    finalizado: {
      color: 'var(--green)',
      bg:    'rgba(16,185,129,0.06)',
      icon:  'fa-check-double',
      msgUser: 'Trabajo finalizado',
      msgPro:  'Trabajo finalizado',
    },
    cancelado: {
      color: 'var(--gray)',
      bg:    'rgba(148,163,184,0.06)',
      icon:  'fa-times-circle',
      msgUser: 'Solicitud cancelada',
      msgPro:  'Solicitud cancelada',
    },
    rechazado: {
      color: 'var(--gray)',
      bg:    'rgba(148,163,184,0.06)',
      icon:  'fa-times-circle',
      msgUser: 'El técnico no estaba disponible',
      msgPro:  'Solicitud rechazada',
    },
    en_disputa: {
      color: '#ef4444',
      bg:    'rgba(239,68,68,0.08)',
      icon:  'fa-shield-halved',
      msgUser: 'Disputa en revisión por el equipo de Tecniya',
      msgPro:  'Disputa en revisión por el equipo de Tecniya',
    },
  };

  const cfg = STATE[j.status] || {
    color: 'var(--gray)', bg: 'rgba(148,163,184,0.06)',
    icon: 'fa-briefcase', msgUser: j.status, msgPro: j.status,
  };
  const mainMsg = viewAs === 'pro' ? cfg.msgPro : cfg.msgUser;

  // ── Info secundaria ──────────────────────────────────────────────────
  const infoItems = [];
  if (j.specialty)      infoItems.push(` ${escHtml(j.specialty)}`);
  if (j.address)        infoItems.push(` ${escHtml(j.address)}`);
  if (j.confirmed_date) {
    try {
      const cd = new Date(j.confirmed_date);
      const fmt = cd.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'});
      infoItems.push(` ${fmt}${j.confirmed_period ? ' — ' + j.confirmed_period : ''}`);
    } catch(e) {}
  }
  if (dateStr) infoItems.push(` ${dateStr}`);
  if (j.is_urgent) infoItems.push(` Urgente`);

  const infoHtml = infoItems.length
    ? `<div class="job-card-info" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
        ${infoItems.map(i => `<span style="font-size:0.75rem;color:var(--gray);background:var(--glass);padding:2px 10px;border-radius:20px;border:1px solid var(--border);">${i}</span>`).join('')}
       </div>`
    : '';

  // ── Descripción del trabajo ──────────────────────────────────────────
  const descHtml = j.description
    ? `<div class="job-card-desc" style="margin-top:12px;font-size:0.9rem;color:var(--light);line-height:1.5;">
        ${escHtml(j.description)}
       </div>`
    : '';

  // ── Alerta de expiración ─────────────────────────────────────────────
  const EXPIRE_HRS = 12;
  let expiryHtml = '';
  if (j.status === 'solicitado' && j.created_at) {
    const hoursOld = (Date.now() - new Date(j.created_at).getTime()) / 36e5;
    if (hoursOld >= EXPIRE_HRS) {
      expiryHtml = `<div style="margin-top:12px;padding:8px 12px;background:rgba(245,158,11,0.1);border-radius:8px;color:#f59e0b;font-size:0.8rem;display:flex;align-items:center;gap:6px;">
        <i class="fa fa-clock"></i> Sin respuesta hace más de ${Math.floor(hoursOld)}h
      </div>`;
    }
  }

  // ── Zona de fecha propuesta (solo fecha_propuesta_pro) ───────────────
  let propFechaHtml = '';
  if (j.status === 'fecha_propuesta_pro' && viewAs === 'user') {
    const slot = j.pro_proposed_dates?.[0];
    let slotStr = 'fecha a confirmar';
    if (slot) try {
      const d = new Date(slot.date);
      slotStr = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})
                + (slot.period ? ' — ' + slot.period : '');
    } catch(e) {}
    propFechaHtml = `<div style="margin-top:12px;padding:12px;background:rgba(168,85,247,0.1);border-radius:10px;border:1px solid rgba(168,85,247,0.2);color:#a855f7;font-size:0.85rem;">
      <i class="fa fa-calendar-plus" style="margin-right:6px;"></i>
      Propone: <strong>${slotStr}</strong>
    </div>`;
  }

  // ── Acciones: botón primario + links secundarios ─────────────────────
  let primaryBtn  = '';
  let secondaryLinks = [];

  if (viewAs === 'pro') {
    if (j.status === 'solicitado') {
      primaryBtn = `<button class="btn btn-success job-card-primary-btn" onclick="window.acceptJob('${j.id}')">
                       <i class="fa fa-check"></i> Aceptar trabajo
                    </button>`;
      secondaryLinks = [
        `<a href="#" onclick="event.preventDefault(); window.openProposeDateModal('${j.id}')" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">Proponer otra fecha</a>`,
        `<a href="#" onclick="event.preventDefault(); window.openRejectModal('${j.id}')" style="color:var(--gray);font-size:0.85rem;text-decoration:none;">Rechazar</a>`,
      ];
    } else if (j.status === 'aceptado') {
      primaryBtn = `<button class="btn btn-primary job-card-primary-btn" onclick="window.startJob('${j.id}')">
                       <i class="fa fa-play"></i> Iniciar trabajo
                    </button>`;
      secondaryLinks = [
        `<a href="#" onclick="event.preventDefault(); window.openChatWith('${j.user_id}')" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">Chat con cliente</a>`,
      ];
    } else if (j.status === 'en_proceso') {
      primaryBtn = `<button class="btn btn-success job-card-primary-btn" onclick="window.finishJob('${j.id}')">
                       <i class="fa fa-flag-checkered"></i> Marcar como terminado
                    </button>`;
      secondaryLinks = [
        `<a href="#" onclick="event.preventDefault(); window.openChatWith('${j.user_id}')" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">Chat con cliente</a>`,
      ];
    } else if (['pendiente_confirmacion', 'para_revision'].includes(j.status)) {
      primaryBtn = `<div style="text-align:center;padding:10px;background:var(--glass);border-radius:10px;color:var(--gray);font-size:0.85rem;width:100%;">
                       Esperando confirmación del cliente
                    </div>`;
    }
  } else {
    // viewAs === 'user'
    if (j.status === 'fecha_propuesta_pro') {
      primaryBtn = `<button class="btn btn-success job-card-primary-btn" onclick="window.approveProDate('${j.id}')">
                       <i class="fa fa-check"></i> Aceptar esta fecha
                    </button>`;
      secondaryLinks = [
        `<a href="#" onclick="event.preventDefault(); window.openProposeDateModal('${j.id}')" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">Proponer otra fecha</a>`,
      ];
    } else if (['pendiente_confirmacion', 'para_revision'].includes(j.status)) {
      primaryBtn = `<button class="btn btn-success job-card-primary-btn" onclick="window.openReviewFlow('${j.id}','${j.professional_id}','${escHtml(j.pro_name||'el técnico')}','confirm')">
                       <i class="fa fa-check-double"></i> Sí, el trabajo quedó listo
                    </button>`;
      secondaryLinks = [
        `<a href="#" onclick="event.preventDefault(); window.openChatWith('${j.professional_id}')" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">Hablar con el técnico</a>`,
        `<a href="#" onclick="event.preventDefault(); window.openWarrantyReport('${j.id}')" style="color:var(--gray);font-size:0.85rem;text-decoration:none;">Reportar un problema</a>`,
      ];
    } else if (j.status === 'solicitado') {
      primaryBtn = `<div style="text-align:center;padding:10px;background:var(--glass);border-radius:10px;color:var(--gray);font-size:0.85rem;width:100%;">
                       Esperando respuesta...
                    </div>`;
      secondaryLinks = [
        j.professional_id
          ? `<a href="#" onclick="event.preventDefault(); window.openChatWith('${j.professional_id}','${j.id}',true)" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">Consultar al técnico</a>`
          : '',
        `<a href="#" onclick="event.preventDefault(); window.openCancelModal('${j.id}','solicitado')" style="color:var(--gray);font-size:0.85rem;text-decoration:none;">Cancelar solicitud</a>`,
      ].filter(Boolean);
    } else if (['aceptado','en_proceso'].includes(j.status)) {
      primaryBtn = `<button class="btn btn-primary job-card-primary-btn" onclick="window.openChatWith('${j.professional_id}')">
                       <i class="fa fa-comments"></i> Chat con el técnico
                    </button>`;
      secondaryLinks = [
        `<a href="#" onclick="event.preventDefault(); window.openCancelModal('${j.id}','activo')" style="color:var(--gray);font-size:0.85rem;text-decoration:none;">Cancelar trabajo</a>`,
      ];
    } else if (j.status === 'finalizado') {
      const alreadyReviewed = localStorage.getItem(`reviewed_${j.id}`) === '1';
      const ratingPromptHtml = (j.client_confirmed && !alreadyReviewed)
        ? `<div style="margin-top:12px;padding:12px;background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
             <div style="font-size:0.82rem;color:var(--light);flex:1;">
               <i class="fa fa-star" style="color:var(--orange);margin-right:6px;"></i> ¿Querés calificar a ${escHtml(j.pro_name || 'el técnico')}?
             </div>
             <button class="btn btn-orange btn-sm" onclick="window.openReviewFlow('${j.id}','${j.professional_id}','${escHtml(j.pro_name||'el técnico')}','rate-only')">Calificar</button>
           </div>`
        : '';

      const ratingBtn = (j.client_confirmed && !alreadyReviewed)
        ? `<button class="btn btn-orange job-card-primary-btn" onclick="window.openReviewFlow('${j.id}','${j.professional_id}','${escHtml(j.pro_name||'el técnico')}','rate-only')">
                 <i class="fa fa-star"></i> Calificar al técnico
              </button>`
        : '';

      const warrantyActive = j.warranty_until && new Date(j.warranty_until) > new Date();
      primaryBtn = ratingBtn || `<button class="btn btn-primary job-card-primary-btn" onclick="window.reHireJob('${j.professional_id}','${j.pro_name||'Profesional'}','${j.professional_id}')">
                       <i class="fa fa-rotate-right"></i> Volver a contratar
                    </button>`;
      
      // Inject banner before actions if needed
      primaryBtn = ratingPromptHtml + primaryBtn;

      if (warrantyActive) {
        secondaryLinks = [
          `<a href="#" onclick="event.preventDefault(); window.openWarrantyReport('${j.id}')" style="color:#f59e0b;font-size:0.85rem;text-decoration:none;"><i class="fa fa-shield-halved"></i> Reportar problema (garantía activa)</a>`,
        ];
      }
    } else if (['cancelado','rechazado'].includes(j.status)) {
      primaryBtn = `<button class="btn btn-ghost job-card-primary-btn" onclick="window.showPage('professionals-list')">
                       <i class="fa fa-search"></i> Buscar otro técnico
                    </button>`;
      if (j.status === 'cancelado' && j.cancel_reason) {
        secondaryLinks = [`<span style="font-size:0.8rem;color:var(--gray);font-style:italic;">"${escHtml(j.cancel_reason)}"</span>`];
      }
    }
  }

  const secondaryHtml = secondaryLinks.length
    ? `<div class="job-card-secondary" style="display:flex;justify-content:center;gap:20px;margin-top:16px;flex-wrap:wrap;">
        ${secondaryLinks.join('')}
       </div>`
    : '';

  // ── Foto adjunta (link pequeño, no botón) ────────────────────────────
  const photoLink = j.photo_url
    ? `<div style="margin-top:10px;">
         <a href="${j.photo_url}" target="_blank" style="font-size:0.75rem;color:var(--accent);text-decoration:none;"><i class="fa fa-image"></i> Ver foto adjunta</a>
       </div>`
    : '';

  // ── Render final ─────────────────────────────────────────────────────
  return `
<div class="job-card" style="background:var(--glass-dark);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:20px;display:flex;flex-direction:column;transition:transform .2s, border-color .2s;">

  <!-- ZONA SUPERIOR: Estado y mensaje -->
  <div class="job-card-header" style="background:${cfg.bg};padding:12px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);">
    <div style="width:36px;height:36px;background:${cfg.color};color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;box-shadow:0 4px 10px ${cfg.color}44;">
      <i class="fa ${cfg.icon}"></i>
    </div>
    <div style="font-weight:600;color:var(--light);font-size:0.95rem;">${mainMsg}</div>
  </div>

  <!-- ZONA MEDIA: Contenido -->
  <div class="job-card-body" style="padding:16px;">

    <!-- Descripción (Principal) -->
    ${descHtml}

    <!-- Fecha propuesta si existe -->
    ${propFechaHtml}

    <!-- Metadatos (Especialidad, Ciudad, etc) -->
    ${infoHtml}

    <!-- Alertas -->
    ${expiryHtml}

    <!-- Links extra -->
    ${photoLink}

    <!-- ZONA INFERIOR: Botón Grande + Links -->
    <div class="job-card-actions" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      ${primaryBtn}
      ${secondaryHtml}
    </div>

  </div>

</div>
`;
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

// Estado interno del flujo de review
let _rvfJobId = null;
let _rvfProId = null;
let _rvfMainRating = 0;
let _rvfSubRatings = { puntualidad: 0, calidad: 0, precio: 0, comunicacion: 0 };

const RVF_STAR_LABELS = ['', 'Muy malo', 'Malo', 'Bueno', 'Muy bueno', 'Excelente'];

export function openReviewFlow(jobId, proId, proName, mode = 'confirm') {
  _rvfJobId = jobId;
  _rvfProId = proId;
  _rvfMainRating = 0;
  _rvfSubRatings = { puntualidad: 0, calidad: 0, precio: 0, comunicacion: 0 };
  store._confirmingJobId = jobId;

  // Nombre del pro en el paso 1
  const nameEl = document.getElementById('rvf-pro-name');
  if (nameEl) nameEl.textContent = proName || 'el técnico';

  // Limpiar estrellas
  document.querySelectorAll('#rvf-stars-main .rvf-star').forEach(s => {
    s.style.color = 'var(--gray2)';
  });
  document.querySelectorAll('.rvf-sub-stars i').forEach(s => {
    s.style.color = 'var(--gray2)';
  });
  const labelEl = document.getElementById('rvf-star-label');
  if (labelEl) labelEl.textContent = '';

  // Limpiar textareas
  const c1 = document.getElementById('rvf-comment');
  const c2 = document.getElementById('rvf-review-text');
  if (c1) c1.value = '';
  if (c2) c2.value = '';

  // Si mode === 'rate-only', ir directo al paso 2
  if (mode === 'rate-only') {
    rvfGoToStep(2);
  } else {
    rvfGoToStep(1);
  }

  showModal('modal-review-flow');
}

function rvfGoToStep(n) {
  document.getElementById('rvf-step1').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('rvf-step2').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('rvf-step1-dot').style.background = 'var(--primary)';
  document.getElementById('rvf-step2-dot').style.background = n === 2 ? 'var(--primary)' : 'var(--border)';
}

export async function rvfConfirm() {
  if (!_rvfJobId) return;
  const sb = getSupabase();
  const comment = document.getElementById('rvf-comment')?.value.trim();

  const btn = document.getElementById('btn-rvf-confirm');
  if (btn) { btn.disabled = true; btn.innerHTML = ' Confirmando...'; }

  const { error } = await sb.from('jobs').update({
    status: 'finalizado',
    client_confirmed: true,
    client_comment: comment || null
  }).eq('id', _rvfJobId);

  if (btn) { btn.disabled = false; btn.innerHTML = ' Sí, quedó listo'; }

  if (error) {
    showToast('Error al confirmar. Intentá de nuevo.', 'error');
    return;
  }

  // Avanzar al paso 2 sin cerrar el modal
  rvfGoToStep(2);
  // Recargar dashboard en background
  import('./dashboard.js').then(m => m.loadUserDashboard());
}

export async function rvfSubmitRating() {
  if (!_rvfJobId || !_rvfProId) return;
  if (_rvfMainRating === 0) {
    showToast('Seleccioná al menos una estrella', 'warning');
    return;
  }

  const sb = getSupabase();
  const comment = document.getElementById('rvf-review-text')?.value.trim();

  // Si no completó las subcategorías, usar la calificación general para todas
  const sub = _rvfSubRatings;
  const puntualidad  = sub.puntualidad  || _rvfMainRating;
  const calidad      = sub.calidad      || _rvfMainRating;
  const precio       = sub.precio       || _rvfMainRating;
  const comunicacion = sub.comunicacion || _rvfMainRating;

  const btn = document.getElementById('btn-rvf-submit');
  if (btn) { btn.disabled = true; btn.innerHTML = ' Enviando...'; }

  // Resolver professional_id (UUID)
  let professionalProfileId = _rvfProId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(professionalProfileId)) {
    const pro = store.allProfessionals?.find(x => String(x.id) === String(_rvfProId));
    professionalProfileId = pro?.user_id || null;
  }
  if (!professionalProfileId) {
    const { data } = await sb.from('professionals').select('user_id').eq('id', _rvfProId).maybeSingle();
    professionalProfileId = data?.user_id || null;
  }

  if (!professionalProfileId) {
    showToast('No se pudo enviar la calificación', 'error');
    closeModal('modal-review-flow');
    return;
  }

  const avg = parseFloat(((puntualidad + calidad + precio + comunicacion) / 4).toFixed(2));

  const { error } = await sb.from('reviews').insert({
    user_id:         store.currentUser.id,
    professional_id: professionalProfileId,
    job_id:          _rvfJobId,
    comment:         comment || null,
    rating:          avg,
    puntualidad,
    calidad,
    precio,
    comunicacion,
    created_at:      new Date().toISOString()
  });

  if (btn) { btn.disabled = false; btn.innerHTML = ' Enviar calificación'; }
  closeModal('modal-review-flow');

  if (error) {
    showToast('Error al enviar calificación', 'error');
  } else {
    localStorage.setItem(`reviewed_${_rvfJobId}`, '1');
    showToast('¡Gracias por calificar! Tu opinión ayuda a la comunidad.', 'success');
    import('./dashboard.js').then(m => m.loadUserDashboard());
  }
}

export function rvfSkipRating() {
  closeModal('modal-review-flow');
  showToast('Podés calificar desde tus trabajos finalizados cuando quieras.', 'info');
}

export function rvfOpenDispute() {
  closeModal('modal-review-flow');
  store._disputeJobId = _rvfJobId;
  const disputeId = document.getElementById('dispute-job-id');
  if (disputeId) disputeId.textContent = _rvfJobId;
  showModal('modal-dispute');
}

// Inicializar eventos de estrellas del nuevo modal
export function initReviewFlowEvents() {
  // Estrellas principales
  const mainStars = document.getElementById('rvf-stars-main');
  if (mainStars) {
    mainStars.addEventListener('click', e => {
      const star = e.target.closest('.rvf-star');
      if (!star) return;
      _rvfMainRating = parseInt(star.dataset.v);
      mainStars.querySelectorAll('.rvf-star').forEach((s, i) => {
        s.style.color = i < _rvfMainRating ? 'var(--orange)' : 'var(--gray2)';
      });
      const labelEl = document.getElementById('rvf-star-label');
      if (labelEl) labelEl.textContent = RVF_STAR_LABELS[_rvfMainRating] || '';
    });
  }

  // Estrellas de subcategorías
  document.querySelectorAll('.rvf-sub-stars').forEach(container => {
    container.addEventListener('click', e => {
      const star = e.target.closest('[data-v]');
      if (!star) return;
      const cat = container.dataset.cat;
      const val = parseInt(star.dataset.v);
      _rvfSubRatings[cat] = val;
      container.querySelectorAll('i').forEach((s, i) => {
        s.style.color = i < val ? 'var(--orange)' : 'var(--gray2)';
      });
    });
  });

  // Botones
  document.getElementById('btn-rvf-confirm')?.addEventListener('click', rvfConfirm);
  document.getElementById('btn-rvf-dispute')?.addEventListener('click', rvfOpenDispute);
  document.getElementById('btn-rvf-submit')?.addEventListener('click', rvfSubmitRating);
  document.getElementById('btn-rvf-skip')?.addEventListener('click', rvfSkipRating);
}

export async function initJobsEventListeners() {
  const urgentSpecialty = document.getElementById('urgent-specialty');
  if (urgentSpecialty) {
    const { loadSpecialties } = await import('./professionals.js');
    await loadSpecialties();
  }
  initReviewFlowEvents();
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
  const { error } = await sb.from('jobs').update({ status: 'para_revision' }).eq('id', jobId);
  if (!error) {
    showToast('Marcaste el trabajo como terminado. El cliente debe revisarlo y finalizar.', 'success');
    const { data: job } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
    if (job?.user_id) {
      import('./notifications.js').then(m => m.createNotification(
        job.user_id, 'job_finished', 'El profesional terminó el trabajo',
        'Revisá el trabajo y confirmá el cierre desde tu panel para finalizar.'
      ));
    }
    const { loadProDashboard } = await import('./dashboard.js');
    loadProDashboard();
  } else showToast('Error: ' + error.message, 'error');
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

// ─── RATINGS & REVIEWS ───────────────────────────────────────────────────────

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
  
  const comment = document.getElementById('rate-comment')?.value.trim() || '';
  const r = store.ratings;
  const avg = (r.puntualidad + r.calidad + r.precio + r.comunicacion) / 4;
  
  const sb = getSupabase();
  const { error } = await sb.from('reviews').insert({
    user_id: store.currentUser.id,
    professional_id: store.currentProIdForAction.proId,
    job_id: store.currentProIdForAction.jobId,
    comment,
    avg_rating: avg,
    puntualidad: r.puntualidad,
    calidad: r.calidad,
    precio: r.precio,
    comunicacion: r.comunicacion,
    created_at: new Date().toISOString()
  });

  if (error) {
    showToast('Error al enviar calificación: ' + error.message, 'error');
  } else {
    closeModal('modal-rating');
    showToast('¡Gracias por tu calificación!', 'success');
  }
}
