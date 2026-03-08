import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast } from './ui.js';
import { formatDateTime } from './utils.js';

// ─── REALTIME ─────────────────────────────────────────────────────────────────

export function setupRealtimeNotifications() {
  if (!store.currentUser) return;
  const sb = getSupabase();
  try {
    sb.channel(`notif:${store.currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${store.currentUser.id}`
      }, payload => {
        addNotification(payload.new);
      })
      .subscribe();
  } catch {}
}

// ─── BADGE (solo cuenta no leídas) ───────────────────────────────────────────

export async function setupNotifBadge() {
  if (!store.currentUser) return;
  const sb = getSupabase();
  try {
    const { data, error } = await sb
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', store.currentUser.id)
      .eq('read', false);

    if (error) { console.warn('notif badge:', error.code); return; }

    const count = data?.length || 0;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
  } catch {}
}

// ─── CARGAR LISTA COMPLETA (últimas 30) ───────────────────────────────────────

export async function loadNotifList() {
  if (!store.currentUser) return;
  const sb = getSupabase();
  const list = document.getElementById('notif-list');
  if (!list) return;

  list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gray);font-size:0.85rem;">
    <div class="loader" style="margin:0 auto 8px;"></div>Cargando...</div>`;

  try {
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', store.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      list.innerHTML = `<div class="empty-state" style="padding:30px 20px;">
        <i class="fa fa-bell-slash"></i><p>No se pudieron cargar las notificaciones.</p></div>`;
      console.warn('loadNotifList:', error.code, error.message);
      return;
    }

    if (!data?.length) {
      list.innerHTML = `<div class="empty-state" style="padding:30px 20px;">
        <i class="fa fa-bell-slash"></i><p>Sin notificaciones</p></div>`;
      return;
    }

    list.innerHTML = data.map(n => notifItemHTML(n)).join('');

    // Marcar como leídas las que se están viendo
    const unreadIds = data.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length) {
      await sb.from('notifications').update({ read: true }).in('id', unreadIds);
      const badge = document.getElementById('notif-badge');
      if (badge) badge.classList.add('hidden');
    }
  } catch (e) {
    console.error('loadNotifList:', e);
    list.innerHTML = `<div class="empty-state" style="padding:30px 20px;">
      <i class="fa fa-bell-slash"></i><p>Error al cargar notificaciones.</p></div>`;
  }
}

function notifItemHTML(n) {
  const isUnread = !n.read;
  const iconMap  = {
    job_request:  { icon: 'fa-briefcase',    color: 'var(--primary)' },
    job_accepted: { icon: 'fa-check-circle', color: 'var(--green)'   },
    job_rejected: { icon: 'fa-times-circle', color: '#ef4444'        },
    job_finished: { icon: 'fa-flag-checkered',color:'var(--accent)'  },
    new_message:  { icon: 'fa-comments',     color: 'var(--accent)'  },
    new_review:   { icon: 'fa-star',         color: '#fbbf24'        },
    dispute:      { icon: 'fa-triangle-exclamation', color: '#f59e0b'},
  };
  const { icon, color } = iconMap[n.type] || { icon: 'fa-bell', color: 'var(--gray)' };
  const date = n.created_at ? formatDateTime(n.created_at) : '';

  return `<div class="notif-item${isUnread ? ' unread' : ''}" style="display:flex;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border);${isUnread ? 'background:rgba(79,70,229,0.06);' : ''}">
    <div style="width:34px;height:34px;border-radius:50%;background:rgba(79,70,229,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <i class="fa ${icon}" style="font-size:0.85rem;color:${color};"></i>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:0.88rem;font-weight:${isUnread ? '600' : '400'};color:var(--light);line-height:1.4;">${n.title || 'Notificación'}</div>
      ${n.message ? `<div style="font-size:0.8rem;color:var(--gray);margin-top:2px;line-height:1.4;">${n.message}</div>` : ''}
      <div style="font-size:0.72rem;color:var(--gray);margin-top:4px;">${date}</div>
    </div>
    ${isUnread ? '<div style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>' : ''}
  </div>`;
}

// ─── NUEVA NOTIFICACIÓN EN TIEMPO REAL ───────────────────────────────────────

export function addNotification(notif) {
  // Incrementar badge
  const badge = document.getElementById('notif-badge');
  if (badge) {
    const count = parseInt(badge.textContent || '0') + 1;
    badge.textContent = count;
    badge.classList.remove('hidden');
  }
  // Si el panel está abierto, agregar al principio
  const panel = document.getElementById('notif-panel');
  if (panel?.classList.contains('open')) {
    const list = document.getElementById('notif-list');
    const empty = list?.querySelector('.empty-state');
    if (empty) empty.remove();
    if (list) list.insertAdjacentHTML('afterbegin', notifItemHTML(notif));
  }
  showToast(notif.title || 'Nueva notificación', 'info');
}

// ─── TOGGLE PANEL ─────────────────────────────────────────────────────────────

export function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (isOpen) loadNotifList(); // cargar al abrir
}

// ─── MARCAR TODAS LEÍDAS ──────────────────────────────────────────────────────

export async function markAllRead() {
  if (!store.currentUser) return;
  const sb = getSupabase();
  const { error } = await sb
    .from('notifications').update({ read: true })
    .eq('user_id', store.currentUser.id).eq('read', false);
  if (error) { console.warn('markAllRead:', error.message); return; }

  const badge = document.getElementById('notif-badge');
  if (badge) badge.classList.add('hidden');

  // Re-renderizar lista con items ya leídos (quitar punto azul)
  const list = document.getElementById('notif-list');
  if (list) {
    list.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      el.style.background = '';
      const dot = el.querySelector('[style*="border-radius:50%"][style*="background:var(--accent)"]');
      if (dot) dot.remove();
    });
  }
}

// ─── CREAR NOTIFICACIÓN (helper para otros módulos) ───────────────────────────

export async function createNotification(userId, type, title, message) {
  if (!userId) return;
  const sb = getSupabase();
  await sb.from('notifications').insert({ user_id: userId, type, title, message });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

export function initNotificationsEvents() {
  document.getElementById('notif-btn')?.addEventListener('click', toggleNotifPanel);
  document.getElementById('mark-all-read-btn')?.addEventListener('click', markAllRead);

  // Cerrar panel al hacer click afuera
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    const btn   = document.getElementById('notif-btn');
    if (panel?.classList.contains('open') && !panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.remove('open');
    }
  });
}
