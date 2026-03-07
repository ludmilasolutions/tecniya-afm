import { getSupabase } from './supabase.js';
import { showToast } from './ui.js';
import { formatDate } from './utils.js';

export async function loadAdminData() {
  const sb = getSupabase();
  
  try {
    const [{ count: uc }, { count: pc }, { count: fc }, { count: jc }] = await Promise.all([
      sb.from('users').select('*', { count: 'exact', head: true }),
      sb.from('professionals').select('*', { count: 'exact', head: true }),
      sb.from('professionals').select('*', { count: 'exact', head: true }).eq('is_featured', true),
      sb.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'finalizado'),
    ]);
    
    const usersEl = document.getElementById('adm-stat-users');
    const prosEl = document.getElementById('adm-stat-pros');
    const featuredEl = document.getElementById('adm-stat-featured');
    const jobsEl = document.getElementById('adm-stat-jobs');
    
    if (usersEl) usersEl.textContent = uc || 0;
    if (prosEl) prosEl.textContent = pc || 0;
    if (featuredEl) featuredEl.textContent = fc || 0;
    if (jobsEl) jobsEl.textContent = jc || 0;
    
    const { data: users } = await sb.from('users').select('id,full_name,email,role,created_at').limit(50);
    if (users) {
      const tbody = document.getElementById('users-tbody');
      if (tbody) {
        tbody.innerHTML = users.map(u => `
          <tr>
            <td style="font-size:0.78rem;color:var(--gray2);">${u.id.slice(0, 8)}...</td>
            <td>${u.full_name || '-'}</td>
            <td>${u.email || '-'}</td>
            <td><span class="badge badge-${u.role === 'admin' ? 'destacado' : u.role === 'professional' ? 'certificado' : 'disponible'}">${u.role || 'user'}</span></td>
            <td>${u.created_at ? formatDate(u.created_at) : '-'}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="window.blockUser('${u.id}')"><i class="fa fa-ban"></i></button></td>
          </tr>
        `).join('');
      }
    }
    
    const { data: pros } = await sb.from('professionals').select('*,users(full_name)').limit(50);
    if (pros) {
      const tbody = document.getElementById('pros-tbody');
      if (tbody) {
        tbody.innerHTML = pros.map(p => `
          <tr>
            <td>${p.users?.full_name || '-'}</td>
            <td>${p.specialty || '-'}</td>
            <td>${p.city || '-'}</td>
            <td>${p.avg_rating || '-'}</td>
            <td>${p.is_featured ? '<span class="badge badge-destacado">Sí</span>' : '<span style="color:var(--gray);">No</span>'}</td>
            <td>
              <button class="btn btn-accent btn-sm" onclick="window.approveFeatured('${p.id}')"><i class="fa fa-crown"></i></button>
              <button class="btn btn-danger btn-sm" onclick="window.blockUser('${p.user_id}')"><i class="fa fa-ban"></i></button>
            </td>
          </tr>
        `).join('');
      }
    }
    
    const { data: ads } = await sb.from('ads').select('*').limit(50);
    if (ads) {
      const tbody = document.getElementById('ads-tbody');
      if (tbody) {
        tbody.innerHTML = ads.map(a => `
          <tr>
            <td>${a.title || a.name || '-'}</td>
            <td><span class="ad-level-badge ad-level-${a.level}">${a.level}</span></td>
            <td>${a.province || a.city || 'Nacional'}</td>
            <td>${a.link ? `<a href="${a.link}" target="_blank" style="color:var(--accent);">Ver</a>` : '-'}</td>
            <td>${a.active ? '<span style="color:var(--green);">Activa</span>' : '<span style="color:var(--gray);">Inactiva</span>'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="window.deleteAd('${a.id}')"><i class="fa fa-trash"></i></button></td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.log('Admin data:', e.message);
  }
}

export function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    if (t) t.style.display = 'none';
  });
  document.querySelectorAll('.admin-sidebar-item').forEach(i => {
    if (i) i.classList.remove('active');
  });
  
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = 'block';
  
  if (event?.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

export async function blockUser(uid) {
  const sb = getSupabase();
  const { error } = await sb.from('users').update({ blocked: true }).eq('id', uid);
  
  if (!error) {
    showToast('Usuario bloqueado', 'success');
  }
}

export async function approveFeatured(proId) {
  const sb = getSupabase();
  const { error } = await sb.from('professionals').update({ is_featured: true }).eq('id', proId);
  
  if (!error) {
    showToast('Profesional destacado aprobado', 'success');
    loadAdminData();
  }
}

export async function deleteAd(adId) {
  const sb = getSupabase();
  const { error } = await sb.from('ads').delete().eq('id', adId);
  
  if (!error) {
    showToast('Publicidad eliminada', 'success');
    loadAdminData();
  }
}

export function filterAdminTable(query, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
  });
}
