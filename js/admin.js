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
    .select('id,full_name,email,role,blocked,created_at')
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
      <td>${escapeHtml(u.email || '-')}</td>
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
    .select('*, profiles:user_id(full_name, email, avatar_url)')
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
  
  const { data: jobs } = await sb
    .from('jobs')
    .select('*, profiles:user_id(full_name), professionals:professional_id(specialty)')
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
      <td>${escapeHtml(j.professionals?.specialty || '-')}</td>
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
    .select('*, profiles:user_id(full_name), professionals:professional_id(specialty)')
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
      <td>${escapeHtml(s.professionals?.specialty || '-')}</td>
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
    .select('*, profiles:user_id(full_name), professionals:professional_id(specialty)')
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
      <td>${escapeHtml(r.professionals?.specialty || '-')}</td>
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
    const { data: sub } = await sb.from('subscriptions').select('professional_id').eq('id', subId).single();
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
