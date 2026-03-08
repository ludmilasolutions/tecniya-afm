import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast } from './ui.js';
import { formatDateTime } from './utils.js';

export function setupRealtimeNotifications() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  try {
    sb.channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${store.currentUser.id}`
      }, payload => {
        addNotification(payload.new);
      })
      .subscribe();
  } catch {}
}

export async function setupNotifBadge() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  try {
    const { data, error } = await sb.from('notifications')
      .select('*')
      .eq('user_id', store.currentUser.id)
      .eq('read', false);

    if (error) {
      // 403 = tabla sin RLS permisiva — ignorar silenciosamente
      console.warn('notifications:', error.code, error.message);
      return;
    }
    
    if (data && data.length > 0) {
      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = data.length;
        badge.classList.remove('hidden');
      }
      
      const list = document.getElementById('notif-list');
      if (list) {
        list.innerHTML = data.map(n => `
          <div class="notif-item unread">
            <div class="notif-dot"></div>
            <div class="notif-content">
              <div class="notif-title">${n.title || 'Notificación'}</div>
              <div class="notif-msg">${n.message || ''}</div>
              <div class="notif-time">${n.created_at ? formatDateTime(n.created_at) : ''}</div>
            </div>
          </div>
        `).join('');
      }
    }
  } catch {}
}

export function addNotification(notif) {
  const badge = document.getElementById('notif-badge');
  if (badge) {
    const count = parseInt(badge.textContent || 0) + 1;
    badge.textContent = count;
    badge.classList.remove('hidden');
  }
  
  showToast(notif.title || 'Nueva notificación', 'info');
}

export function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (panel) {
    panel.classList.toggle('open');
  }
}

export async function markAllRead() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  const { error: mErr } = await sb.from('notifications').update({ read: true }).eq('user_id', store.currentUser.id);
  if (mErr) console.warn('markAllRead:', mErr.message);
  
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.classList.add('hidden');
  }
  
  const list = document.getElementById('notif-list');
  if (list) {
    list.innerHTML = '<div class="empty-state" style="padding:30px 20px;"><i class="fa fa-check-circle" style="color:var(--green);"></i><p>Todo leído</p></div>';
  }
}

export function initNotificationsEvents() {
  const notifBtn = document.getElementById('notif-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', toggleNotifPanel);
  }
}
