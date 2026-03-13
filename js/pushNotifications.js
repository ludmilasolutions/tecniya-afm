import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast } from './ui.js';
import { FIREBASE_CONFIG } from './config.js';

let messaging = null;
let fcmToken = null;

export async function initPushNotifications() {
  if (!('Notification' in window)) {
    console.log('[FCM] Push notifications not supported');
    return;
  }

  if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === 'TU_API_KEY') {
    console.log('[FCM] Firebase not configured. Add config in config.js');
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[FCM] Background message:', payload);
      showNotificationPayload(payload.notification);
    });

    const permission = Notification.permission;
    if (permission === 'granted') {
      await getFCMToken();
    } else if (permission === 'default') {
      console.log('[FCM] Permission not determined yet');
    }
  } catch (error) {
    console.error('[FCM] Init error:', error);
  }
}

export async function requestPushPermission() {
  if (!messaging) {
    await initPushNotifications();
  }

  if (!messaging) {
    showToast('Push notifications no disponibles', 'error');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await getFCMToken();
      showToast('Notificaciones activadas', 'success');
      return true;
    } else if (permission === 'denied') {
      showToast('Permiso de notificaciones denegado', 'error');
      return false;
    }
  } catch (error) {
    console.error('[FCM] Permission error:', error);
    return false;
  }
}

async function getFCMToken() {
  try {
    const token = await messaging.getToken({
      vapidKey: 'TU_VAPID_KEY_AQUI'
    });
    
    if (token) {
      fcmToken = token;
      console.log('[FCM] Token obtained');
      await saveTokenToServer(token);
      return token;
    }
  } catch (error) {
    console.error('[FCM] Token error:', error);
  }
  return null;
}

async function saveTokenToServer(token) {
  if (!store.currentUser) return;

  const sb = getSupabase();
  
  const { error } = await sb.from('push_tokens').upsert({
    user_id: store.currentUser.id,
    token: token,
    device_type: 'web',
    created_at: new Date().toISOString()
  }, {
    onConflict: 'token'
  });

  if (error) {
    console.warn('[FCM] Save token error:', error);
  } else {
    console.log('[FCM] Token saved to server');
  }
}

export async function deleteFCMToken() {
  if (!messaging) return;

  try {
    await messaging.deleteToken();
    fcmToken = null;
    console.log('[FCM] Token deleted');
  } catch (error) {
    console.error('[FCM] Delete token error:', error);
  }
}

function showNotificationPayload(notification) {
  if (!notification) return;

  const title = notification.title || 'TECNIYA';
  const options = {
    body: notification.body || '',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    tag: 'tecniya-notif',
    renotify: true,
    data: notification.data || {}
  };

  if (Notification.permission === 'granted') {
    new Notification(title, options);
  }
}

export function onForegroundMessage() {
  if (!messaging) return;

  messaging.onMessage((payload) => {
    console.log('[FCM] Foreground message:', payload);
    const notification = payload.notification || payload.data;
    showNotificationPayload(notification);
    
    if (payload.data?.type) {
      const { addNotification } = await import('./notifications.js');
      addNotification({
        id: Date.now().toString(),
        type: payload.data.type,
        title: payload.data.title || notification?.title,
        message: payload.data.body || notification?.body,
        read: false,
        created_at: new Date().toISOString()
      });
    }
  });
}

export function setupPushNotificationsUI() {
  const notifToggle = document.getElementById('notif-push-toggle');
  if (!notifToggle) return;

  const currentPerm = Notification.permission;
  
  if (currentPerm === 'granted') {
    notifToggle.innerHTML = '<i class="fa fa-bell"></i> Notificaciones activadas';
    notifToggle.classList.add('btn-success');
  } else if (currentPerm === 'denied') {
    notifToggle.innerHTML = '<i class="fa fa-bell-slash"></i> Bloqueadas';
    notifToggle.classList.add('btn-danger');
  } else {
    notifToggle.innerHTML = '<i class="fa fa-bell"></i> Activar notificaciones';
    notifToggle.onclick = requestPushPermission;
  }
}

export function togglePushNotifications() {
  const permission = Notification.permission;
  
  if (permission === 'granted') {
    deleteFCMToken();
    showToast('Notificaciones desactivadas', 'info');
  } else if (permission === 'default') {
    requestPushPermission();
  }
}
