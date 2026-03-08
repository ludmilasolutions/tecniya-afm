import { getSupabase } from './supabase.js';
import { showToast, showPage } from './ui.js';
import { formatDate } from './utils.js';

export async function loadAdminData() {
  const sb = getSupabase();
  
  try {
    const [{ count: uc }, { count: pc }, { count: fc }, { count: jc }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'professional'),
      sb.from('professionals').select('*', { count: 'exact', head: true }).eq('is_featured', true),
      sb.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'finalizado'),
    ]);
    
    updateStat('adm-stat-users', uc || 0);
    updateStat('adm-stat-pros', pc || 0);
    updateStat('adm-stat-featured', fc || 0);
    updateStat('adm-stat-jobs', jc || 0);
    
    await Promise.all([
      loadAdminUsers(),
      loadAdminPros(),
      loadAdminJobs(),
      loadAdminSubscriptions(),
      loadAdminAds(),
      loadAdminReviews()
    ]);
  } catch (e) {
    console.log('Admin data:', e.message);
  }
}

function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadAdminUsers() {
  const sb = getSupabase();
  
  const { data: users } = await sb
    .from('profiles')
    .select('id,full_name,role,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray);">No hay usuarios</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-size:0.78rem;color:var(--gray2);">${u.id.slice(0, 8)}...</td>
      <td>${escapeHtml(u.full_name || '-')}</td>
      <td><span class="badge badge-${u.role === 'admin' ? 'destacado' : u.role === 'professional' ? 'certificado' : 'disponible'}">${u.role || 'user'}</span></td>
      <td>${u.created_at ? formatDate(u.created_at) : '-'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="window.adminEditUser('${u.id}')" title="Editar"><i class="fa fa-pencil"></i></button>
        <button class="btn btn-${u.blocked ? 'success' : 'danger'} btn-sm" onclick="window.adminToggleBlock('${u.id}', ${!u.blocked})" title="${u.blocked ? 'Desbloquear' : 'Bloquear'}">
          <i class="fa fa-${u.blocked ? 'unlock' : 'ban'}"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadAdminPros() {
  const sb = getSupabase();
  
  const { data: pros } = await sb
    .from('professionals')
    .select('id,user_id,specialty,avg_rating,is_featured,created_at,profiles:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('pros-tbody');
  if (!tbody) return;

  if (!pros || pros.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray);">No hay profesionales</td></tr>';
    return;
  }

  tbody.innerHTML = pros.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="chat-conv-avatar" style="width:32px;height:32px;font-size:0.75rem;">
            ${p.profiles?.full_name?.charAt(0) || 'P'}
          </div>
          ${escapeHtml(p.profiles?.full_name || '-')}
        </div>
      </td>
      <td>${escapeHtml(p.specialty || '-')}</td>
      <td>${escapeHtml(p.city || '-')}</td>
      <td>${p.avg_rating ? p.avg_rating.toFixed(1) : '-'}</td>
      <td>${p.is_featured ? '<span class="badge badge-destacado">Sí</span>' : '<span style="color:var(--gray);">No</span>'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="window.adminViewPro('${p.id}')" title="Ver"><i class="fa fa-eye"></i></button>
        <button class="btn btn-${p.is_featured ? 'danger' : 'accent'} btn-sm" onclick="window.adminToggleFeatured('${p.id}', ${!p.is_featured})" title="${p.is_featured ? 'Quitar destacado' : 'Destacar'}">
          <i class="fa fa-crown"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.adminBlockPro('${p.user_id}')" title="Bloquear"><i class="fa fa-ban"></i></button>
      </td>
    </tr>
  `).join('');
}

async function loadAdminJobs() {
  const sb = getSupabase();
  
  const { data: jobs, error: jobErr } = await sb
    .from('jobs')
    .select('id,user_id,professional_id,status,created_at,profiles:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('jobs-tbody');
  if (!tbody) return;

  if (!jobs || jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray);">No hay trabajos</td></tr>';
    return;
  }
  
  tbody.innerHTML = jobs.map(j => `
    <tr>
      <td style="font-size:0.78rem;color:var(--gray2);">${j.id.slice(0, 8)}...</td>
      <td>${escapeHtml(j.profiles?.full_name || '-')}</td>
      <td>${j.professional_id ? j.professional_id.slice(0,8)+'…' : '-'}</td>
      <td><span class="job-status status-${j.status}">${j.status}</span></td>
      <td>${j.created_at ? formatDate(j.created_at) : '-'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="window.adminViewJob('${j.id}')" title="Ver"><i class="fa fa-eye"></i></button>
        ${j.status !== 'finalizado' && j.status !== 'cancelado' ? `<button class="btn btn-danger btn-sm" onclick="window.adminCancelJob('${j.id}')" title="Cancelar"><i class="fa fa-times"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadAdminSubscriptions() {
  const sb = getSupabase();
  
  const { data: subs } = await sb
    .from('subscriptions')
    .select('id,professional_id,user_id,type,status,starts_at,ends_at,cancelled_at,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('subs-tbody');
  if (!tbody) return;

  if (!subs || subs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray);">No hay suscripciones</td></tr>';
    return;
  }

  tbody.innerHTML = subs.map(s => `
    <tr>
      <td>${'-'}</td>
      <td><span class="badge badge-${s.type === 'destacado' ? 'destacado' : 'nuevo'}">${s.type}</span></td>
      <td>${s.starts_at ? formatDate(s.starts_at) : '-'}</td>
      <td>${s.ends_at ? formatDate(s.ends_at) : '-'}</td>
      <td><span class="badge badge-${s.status === 'active' ? 'disponible' : s.status === 'cancelled' ? 'certificado' : 'nuevo'}">${s.status}</span></td>
      <td>
        ${s.status === 'active' ? `<button class="btn btn-danger btn-sm" onclick="window.adminCancelSubscription('${s.id}')" title="Cancelar"><i class="fa fa-times"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadAdminAds() {
  const sb = getSupabase();
  
  const { data: ads } = await sb
    .from('ads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const tbody = document.getElementById('ads-tbody');
  if (!tbody) return;

  if (!ads || ads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray);">No hay publicidades</td></tr>';
    return;
  }

  tbody.innerHTML = ads.map(a => `
    <tr>
      <td>${escapeHtml(a.title || '-')}</td>
      <td><span class="ad-level-badge ad-level-${a.level}">${a.level}</span></td>
      <td>${escapeHtml(a.province || a.city || 'Nacional')}</td>
      <td>${a.link ? `<a href="${a.link}" target="_blank" style="color:var(--accent);">Ver</a>` : '-'}</td>
      <td>${a.active ? '<span style="color:var(--green);">Activa</span>' : '<span style="color:var(--gray);">Inactiva</span>'}</td>
      <td>
        <button class="btn btn-${a.active ? 'danger' : 'success'} btn-sm" onclick="window.adminToggleAd('${a.id}', ${!a.active})" title="${a.active ? 'Desactivar' : 'Activar'}">
          <i class="fa fa-toggle-${a.active ? 'on' : 'off'}"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.adminDeleteAd('${a.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

async function loadAdminReviews() {
  const sb = getSupabase();
  
  const { data: reviews } = await sb
    .from('reviews')
    .select('id,user_id,professional_id,rating,comment,is_public,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const tbody = document.getElementById('reviews-admin-tbody');
  if (!tbody) return;

  if (!reviews || reviews.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray);">No hay reseñas</td></tr>';
    return;
  }

  tbody.innerHTML = reviews.map(r => `
    <tr>
      <td>${escapeHtml(r.profiles?.full_name || '-')}</td>
      <td>${'-'}</td>
      <td><span style="color:var(--orange);font-weight:700;">${r.rating?.toFixed(1) || '-'}</span></td>
      <td>${escapeHtml(r.comment?.substring(0, 50) || '-')}${r.comment?.length > 50 ? '...' : ''}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="window.adminDeleteReview('${r.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

export function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    if (t) t.style.display = 'none';
  });
  
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = 'block';

  document.querySelectorAll('.admin-sidebar-item').forEach(i => {
    if (i) {
      const isActive = i.dataset.tab === tabId;
      i.classList.toggle('active', isActive);
    }
  });
}

export async function adminEditUser(userId) {
  showToast('Función de edición en desarrollo', 'info');
}

export async function adminToggleBlock(userId, blocked) {
  const sb = getSupabase();
  const { error } = await sb.from('profiles').update({ blocked }).eq('id', userId);
  
  if (!error) {
    showToast(blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado', 'success');
    loadAdminUsers();
  }
}

export async function adminToggleFeatured(proId, featured) {
  const sb = getSupabase();
  const { error } = await sb.from('professionals').update({ is_featured: featured }).eq('id', proId);
  
  if (!error) {
    showToast(featured ? 'Profesional destacado' : 'Destacado removido', 'success');
    loadAdminPros();
  }
}

export async function adminBlockPro(userId) {
  const sb = getSupabase();
  const { error } = await sb.from('profiles').update({ blocked: true }).eq('id', userId);
  
  if (!error) {
    showToast('Profesional bloqueado', 'success');
    loadAdminPros();
  }
}

export async function adminViewPro(proId) {
  showToast('Ver perfil profesional', 'info');
}

export async function adminViewJob(jobId) {
  showToast('Ver detalles del trabajo', 'info');
}

export async function adminCancelJob(jobId) {
  if (!confirm('¿Estás seguro de cancelar este trabajo?')) return;
  
  const sb = getSupabase();
  const { error } = await sb.from('jobs').update({ 
    status: 'cancelado',
    cancelled_at: new Date().toISOString()
  }).eq('id', jobId);
  
  if (!error) {
    showToast('Trabajo cancelado', 'success');
    loadAdminJobs();
  }
}

export async function adminCancelSubscription(subId) {
  if (!confirm('¿Estás seguro de cancelar esta suscripción?')) return;
  
  const sb = getSupabase();
  const { error } = await sb.from('subscriptions').update({ 
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  }).eq('id', subId);
  
  if (!error) {
    const { data: sub } = await sb.from('subscriptions').select('professional_id').eq('id', subId).maybeSingle();
    if (sub?.professional_id) {
      await sb.from('professionals').update({ is_featured: false }).eq('user_id', sub.professional_id);
    }
    
    showToast('Suscripción cancelada', 'success');
    loadAdminSubscriptions();
  }
}

export async function adminToggleAd(adId, active) {
  const sb = getSupabase();
  const { error } = await sb.from('ads').update({ active }).eq('id', adId);
  
  if (!error) {
    showToast(active ? 'Publicidad activada' : 'Publicidad desactivada', 'success');
    loadAdminAds();
  }
}

export async function adminDeleteAd(adId) {
  if (!confirm('¿Estás seguro de eliminar esta publicidad?')) return;
  
  const sb = getSupabase();
  const { error } = await sb.from('ads').delete().eq('id', adId);
  
  if (!error) {
    showToast('Publicidad eliminada', 'success');
    loadAdminAds();
  }
}

export async function adminDeleteReview(reviewId) {
  if (!confirm('¿Estás seguro de eliminar esta reseña?')) return;
  
  const sb = getSupabase();
  const { error } = await sb.from('reviews').delete().eq('id', reviewId);
  
  if (!error) {
    showToast('Reseña eliminada', 'success');
    loadAdminReviews();
  }
}

export async function adminViewAuditLog() {
  const sb = getSupabase();
  
  const { data: logs } = await sb
    .from('audit_log')
    .select('*, profiles:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  console.log('Audit Log:', logs);
  showToast('Revisa la consola para ver el log de auditoría', 'info');
}

export function filterAdminTable(query, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.adminEditUser = adminEditUser;
window.adminToggleBlock = adminToggleBlock;
window.adminToggleFeatured = adminToggleFeatured;
window.adminBlockPro = adminBlockPro;
window.adminViewPro = adminViewPro;
window.adminViewJob = adminViewJob;
window.adminCancelJob = adminCancelJob;
window.adminCancelSubscription = adminCancelSubscription;
window.adminToggleAd = adminToggleAd;
window.adminDeleteAd = adminDeleteAd;
window.adminDeleteReview = adminDeleteReview;
window.adminViewAuditLog = adminViewAuditLog;

// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE PENALIZACIONES — funciones admin
// ══════════════════════════════════════════════════════════════════════════════
import {
  applyPenalty, revertPenalty, suspendPro, unsuspendPro,
  setUrgentBlock, blockUserTemp, loadPenalties, loadReports, reviewReport,
  PENALTY_WEIGHTS
} from './penalties.js';

// ─── Cargar panel de penalizaciones ───────────────────────────────────────────
export async function loadAdminPenalties() {
  await Promise.all([
    loadPenaltiesList(),
    loadReportsList('pending'),
    loadPenalizedPros(),
  ]);
}

async function loadPenaltiesList() {
  const sb = getSupabase();
  const { data } = await sb
    .from('penalties')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80);

  const tbody = document.getElementById('penalties-tbody');
  if (!tbody) return;
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="adm-empty">Sin penalizaciones registradas</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(p => {
    const typeLabel = {
      cancel: 'Cancelación', no_response: 'Sin respuesta', bad_review: 'Mala reseña',
      report: 'Reporte', warning: 'Advertencia', suspension: 'Suspensión',
    }[p.type] || p.type;
    const deltaHtml = p.delta < 0
      ? `<span class="penalty-delta neg">${p.delta}</span>`
      : `<span class="penalty-delta">—</span>`;
    const statusHtml = p.reverted
      ? '<span class="badge badge-disponible">Revertida</span>'
      : '<span class="badge badge-destacado">Activa</span>';
    return `<tr>
      <td style="font-size:0.76rem;color:var(--gray2);">${p.id.slice(0,8)}…</td>
      <td><span class="penalty-type-badge type-${p.type}">${typeLabel}</span></td>
      <td style="font-size:0.82rem;">${escapeHtml(p.description || '—')}</td>
      <td>${deltaHtml}</td>
      <td>${statusHtml}</td>
      <td>
        ${!p.reverted ? `<button class="btn btn-ghost btn-sm" onclick="window.adminRevertPenalty('${p.id}')" title="Revertir"><i class="fa fa-rotate-left"></i></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function loadReportsList(status) {
  const sb = getSupabase();
  let q = sb.from('reports')
    .select('id,reason,description,status,created_at,professional_id,reporter_id')
    .order('created_at', { ascending: false }).limit(80);
  if (status !== 'all') q = q.eq('status', status);
  const { data } = await q;

  const tbody = document.getElementById('reports-tbody');
  if (!tbody) return;
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="adm-empty">Sin reportes</td></tr>';
    return;
  }
  const reasonLabel = {
    estafa: '🚨 Estafa', mal_trato: '😠 Mal trato',
    trabajo_incompleto: '🔧 Trabajo incompleto',
    no_se_presento: '👻 No se presentó', otro: '📋 Otro'
  };
  tbody.innerHTML = data.map(r => `
    <tr>
      <td style="font-size:0.76rem;color:var(--gray2);">${r.id.slice(0,8)}…</td>
      <td>${reasonLabel[r.reason] || r.reason}</td>
      <td style="font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.description || '—')}</td>
      <td style="font-size:0.76rem;color:var(--gray);">${new Date(r.created_at).toLocaleDateString('es-AR')}</td>
      <td><span class="badge badge-${r.status==='pending'?'nuevo':r.status==='confirmed'?'destacado':'disponible'}">${r.status}</span></td>
      <td style="display:flex;gap:4px;">
        ${r.status === 'pending' ? `
          <button class="btn btn-success btn-sm" onclick="window.adminConfirmReport('${r.id}','${r.professional_id}')" title="Confirmar"><i class="fa fa-check"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="window.adminDismissReport('${r.id}')" title="Desestimar"><i class="fa fa-xmark"></i></button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadPenalizedPros() {
  const sb = getSupabase();
  const { data } = await sb
    .from('professionals')
    .select('id,user_id,specialty,ranking_score,trust_score,cancel_count,report_count,warning_count,suspended,urgent_blocked,profiles:user_id(full_name)')
    .or('ranking_score.lt.80,suspended.eq.true,report_count.gt.0,cancel_count.gt.0')
    .order('ranking_score', { ascending: true })
    .limit(60);

  const tbody = document.getElementById('penalized-pros-tbody');
  if (!tbody) return;
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Sin profesionales penalizados</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(p => {
    const scoreColor = p.ranking_score >= 80 ? 'var(--green)' : p.ranking_score >= 50 ? 'var(--orange)' : '#f87171';
    const statusBadge = p.suspended
      ? '<span class="badge badge-destacado">Suspendido</span>'
      : '<span class="badge badge-disponible">Activo</span>';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="chat-conv-avatar" style="width:30px;height:30px;font-size:0.72rem;">${p.profiles?.full_name?.charAt(0)||'P'}</div>
          ${escapeHtml(p.profiles?.full_name || '—')}
        </div>
      </td>
      <td>${escapeHtml(p.specialty||'—')}</td>
      <td><span style="font-weight:700;color:${scoreColor};">${p.ranking_score}</span></td>
      <td>
        <span title="Cancelaciones" style="margin-right:6px;">❌ ${p.cancel_count||0}</span>
        <span title="Reportes" style="margin-right:6px;">🚨 ${p.report_count||0}</span>
        <span title="Advertencias">⚠️ ${p.warning_count||0}</span>
      </td>
      <td>${statusBadge}</td>
      <td>${p.urgent_blocked ? '<span style="color:#f87171;font-size:0.78rem;">Bloqueado</span>' : '<span style="color:var(--green);font-size:0.78rem;">OK</span>'}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="window.adminOpenPenaltyModal('${p.id}','${escapeHtml(p.profiles?.full_name||'')}')" title="Penalizar"><i class="fa fa-gavel"></i></button>
        ${p.suspended
          ? `<button class="btn btn-success btn-sm" onclick="window.adminUnsuspend('${p.id}')" title="Levantar suspensión"><i class="fa fa-unlock"></i></button>`
          : `<button class="btn btn-danger btn-sm" onclick="window.adminSuspendModal('${p.id}','${escapeHtml(p.profiles?.full_name||'')}')" title="Suspender"><i class="fa fa-ban"></i></button>`}
        <button class="btn btn-${p.urgent_blocked?'success':'orange'} btn-sm" onclick="window.adminToggleUrgent('${p.id}',${!p.urgent_blocked})" title="${p.urgent_blocked?'Habilitar urgentes':'Bloquear urgentes'}"><i class="fa fa-bolt"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="window.adminViewPenalties('${p.id}')" title="Ver historial"><i class="fa fa-clock-rotate-left"></i></button>
      </td>
    </tr>`;
  }).join('');
}

// ─── Acciones admin penalizaciones ────────────────────────────────────────────
export async function adminRevertPenalty(penaltyId) {
  if (!confirm('¿Revertir esta penalización?')) return;
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  try {
    await revertPenalty(penaltyId, user.id);
    showToast('Penalización revertida', 'success');
    loadAdminPenalties();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

export async function adminConfirmReport(reportId, proId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  await reviewReport(reportId, 'confirmed', user.id);
  // Aplicar penalización al pro
  await applyPenalty({
    targetId: proId, targetType: 'professional',
    type: 'report', description: 'Reporte de usuario confirmado por admin',
    delta: PENALTY_WEIGHTS.report, adminId: user.id,
  });
  showToast('Reporte confirmado — penalización aplicada', 'success');
  loadAdminPenalties();
}

export async function adminDismissReport(reportId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  await reviewReport(reportId, 'dismissed', user.id);
  showToast('Reporte desestimado', 'info');
  loadReportsList('pending');
}

export async function adminOpenPenaltyModal(proId, name) {
  document.getElementById('penalty-modal-pro-id').value = proId;
  document.getElementById('penalty-modal-title').textContent = `Penalizar a ${name}`;
  document.getElementById('modal-penalty').classList.add('open');
}

export async function adminSubmitPenalty() {
  const sb = getSupabase();
  const proId = document.getElementById('penalty-modal-pro-id')?.value;
  const type  = document.getElementById('penalty-modal-type')?.value;
  const desc  = document.getElementById('penalty-modal-desc')?.value?.trim();
  if (!type || !desc) { showToast('Completá tipo y descripción', 'warning'); return; }
  const { data: { user } } = await sb.auth.getUser();
  try {
    await applyPenalty({
      targetId: proId, targetType: 'professional',
      type, description: desc,
      delta: PENALTY_WEIGHTS[type] ?? 0,
      adminId: user.id,
    });
    showToast('Penalización aplicada', 'success');
    document.getElementById('modal-penalty')?.classList.remove('open');
    loadAdminPenalties();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

export async function adminSuspendModal(proId, name) {
  document.getElementById('suspend-modal-pro-id').value = proId;
  document.getElementById('suspend-modal-title').textContent = `Suspender a ${name}`;
  document.getElementById('modal-suspend').classList.add('open');
}

export async function adminSubmitSuspend() {
  const sb = getSupabase();
  const proId  = document.getElementById('suspend-modal-pro-id')?.value;
  const reason = document.getElementById('suspend-modal-reason')?.value?.trim();
  const days   = parseInt(document.getElementById('suspend-modal-days')?.value) || 7;
  if (!reason) { showToast('Ingresá el motivo', 'warning'); return; }
  const { data: { user } } = await sb.auth.getUser();
  try {
    await suspendPro({ proId, reason, days, adminId: user.id });
    showToast(`Profesional suspendido por ${days} días`, 'success');
    document.getElementById('modal-suspend')?.classList.remove('open');
    loadAdminPenalties();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

export async function adminUnsuspend(proId) {
  if (!confirm('¿Levantar la suspensión?')) return;
  await unsuspendPro(proId);
  showToast('Suspensión levantada', 'success');
  loadAdminPenalties();
}

export async function adminToggleUrgent(proId, blocked) {
  await setUrgentBlock(proId, blocked);
  showToast(blocked ? 'Trabajos urgentes bloqueados' : 'Trabajos urgentes habilitados', 'success');
  loadPenalizedPros();
}

export async function adminViewPenalties(proId) {
  const penalties = await loadPenalties(proId);
  const list = document.getElementById('penalty-history-list');
  if (!list) return;
  list.innerHTML = penalties.length
    ? penalties.map(p => `
        <div class="penalty-history-item ${p.reverted ? 'reverted' : ''}">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="penalty-type-badge type-${p.type}">${p.type}</span>
            <span style="font-size:0.82rem;">${escapeHtml(p.description||'')}</span>
            ${p.delta ? `<span class="penalty-delta neg">${p.delta}</span>` : ''}
          </div>
          <div style="font-size:0.72rem;color:var(--gray);margin-top:3px;">
            ${new Date(p.created_at).toLocaleString('es-AR')}
            ${p.reverted ? ' · <span style="color:var(--green)">Revertida</span>' : ''}
            ${!p.reverted ? `<button class="btn btn-ghost btn-sm" style="padding:2px 8px;margin-left:8px;" onclick="window.adminRevertPenalty('${p.id}')">Revertir</button>` : ''}
          </div>
        </div>`).join('')
    : '<p style="color:var(--gray);font-size:0.85rem;">Sin penalizaciones</p>';
  document.getElementById('modal-penalty-history')?.classList.add('open');
}

export async function adminFilterReports(status) {
  document.querySelectorAll('.report-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-status="${status}"]`)?.classList.add('active');
  await loadReportsList(status);
}

window.adminRevertPenalty   = adminRevertPenalty;
window.adminConfirmReport   = adminConfirmReport;
window.adminDismissReport   = adminDismissReport;
window.adminOpenPenaltyModal= adminOpenPenaltyModal;
window.adminSubmitPenalty   = adminSubmitPenalty;
window.adminSuspendModal    = adminSuspendModal;
window.adminSubmitSuspend   = adminSubmitSuspend;
window.adminUnsuspend       = adminUnsuspend;
window.adminToggleUrgent    = adminToggleUrgent;
window.adminViewPenalties   = adminViewPenalties;
window.adminFilterReports   = adminFilterReports;

// ══════════════════════════════════════════════════════════════════════════════
// PANEL DE SEGURIDAD
// ══════════════════════════════════════════════════════════════════════════════
export async function loadAdminSecurity() {
  await Promise.all([
    loadSuspiciousAccounts(),
    loadHighCancelUsers(),
    loadHighReportPros(),
  ]);
}

async function loadSuspiciousAccounts() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id,full_name,created_at')
    .eq('suspicious_flag', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    const tbody = document.getElementById('suspicious-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="adm-empty" style="color:var(--orange);">Ejecutá security_migration.sql para activar esta función</td></tr>';
    return;
  }

  const tbody = document.getElementById('suspicious-tbody');
  if (!tbody) return;
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="adm-empty">Sin cuentas sospechosas</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td>${escapeHtml(u.full_name || '—')}</td>
      <td style="font-size:0.78rem;color:var(--orange);">${escapeHtml(u.suspicious_reason || '—')}</td>
      <td style="font-size:0.76rem;color:var(--gray);">${new Date(u.created_at).toLocaleDateString('es-AR')}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="window.adminToggleBlock('${u.id}', true)" title="Bloquear"><i class="fa fa-ban"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="window.adminClearSuspicious('${u.id}')" title="Limpiar flag"><i class="fa fa-check"></i></button>
      </td>
    </tr>`).join('');
}

async function loadHighCancelUsers() {
  const sb = getSupabase();
  const { data, error: e2 } = await sb
    .from('profiles')
    .select('id,full_name')
    .gt('cancel_count', 2)
    .order('cancel_count', { ascending: false })
    .limit(50);

  const tbody = document.getElementById('cancel-users-tbody');
  if (!tbody) return;
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="adm-empty">Sin usuarios con cancelaciones excesivas</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td>${escapeHtml(u.full_name || '—')}</td>
      <td><span style="font-weight:700;color:#f87171;">${u.cancel_count}</span></td>
      <td><span class="badge badge-${u.blocked ? 'destacado' : 'disponible'}">${u.blocked ? 'Bloqueado' : 'Activo'}</span></td>
      <td>
        <button class="btn btn-${u.blocked ? 'success' : 'danger'} btn-sm" onclick="window.adminToggleBlock('${u.id}', ${!u.blocked})">
          <i class="fa fa-${u.blocked ? 'unlock' : 'ban'}"></i>
        </button>
      </td>
    </tr>`).join('');
}

async function loadHighReportPros() {
  const sb = getSupabase();
  const { data } = await sb
    .from('professionals')
    .select('id,user_id,specialty,report_count,cancel_count,ranking_score,suspended,profiles:user_id(full_name)')
    .gt('report_count', 0)
    .order('report_count', { ascending: false })
    .limit(50);

  const tbody = document.getElementById('report-pros-tbody');
  if (!tbody) return;
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="adm-empty">Sin profesionales con reportes</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${escapeHtml(p.profiles?.full_name || '—')}</td>
      <td>${escapeHtml(p.specialty || '—')}</td>
      <td><span style="font-weight:700;color:#f87171;">${p.report_count}</span></td>
      <td><span style="font-weight:700;color:${p.ranking_score<50?'#f87171':p.ranking_score<80?'var(--orange)':'var(--green)'};">${p.ranking_score}</span></td>
      <td><span class="badge badge-${p.suspended ? 'destacado' : 'disponible'}">${p.suspended ? 'Suspendido' : 'Activo'}</span></td>
      <td style="display:flex;gap:4px;">
        <button class="btn btn-ghost btn-sm" onclick="window.adminOpenPenaltyModal('${p.id}','${escapeHtml(p.profiles?.full_name||'')}')" title="Penalizar"><i class="fa fa-gavel"></i></button>
        ${p.suspended
          ? `<button class="btn btn-success btn-sm" onclick="window.adminUnsuspend('${p.id}')"><i class="fa fa-unlock"></i></button>`
          : `<button class="btn btn-danger btn-sm" onclick="window.adminSuspendModal('${p.id}','${escapeHtml(p.profiles?.full_name||'')}')"><i class="fa fa-ban"></i></button>`}
      </td>
    </tr>`).join('');
}

export async function adminClearSuspicious(userId) {
  const sb = getSupabase();
  await sb.from('profiles').update({ suspicious_flag: false, suspicious_reason: null }).eq('id', userId);
  showToast('Flag de sospechoso eliminado', 'success');
  loadSuspiciousAccounts();
}

window.adminClearSuspicious = adminClearSuspicious;
window.loadAdminSecurity    = loadAdminSecurity;
