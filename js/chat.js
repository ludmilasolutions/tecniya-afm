import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast, showPage } from './ui.js';

let currentConversationId = null;

export async function loadConversations() {
  if (!store.currentUser) return [];
  
  const sb = getSupabase();
  
  try {
    const { data: conversations, error } = await sb
      .from('conversations')
      .select(`
        *,
        participant_one:profiles!participant_one_id(id, full_name, avatar_url),
        participant_two:profiles!participant_two_id(id, full_name, avatar_url),
        job:jobs(id, description)
      `)
      .or(`participant_one.eq.${store.currentUser.id},participant_two.eq.${store.currentUser.id}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    const conversationsWithMeta = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count: unreadCount } = await sb
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('read', false)
          .neq('sender_id', store.currentUser.id);

        const otherUser = conv.participant_one?.id === store.currentUser.id 
          ? conv.participant_two 
          : conv.participant_one;

        return {
          ...conv,
          other_user: otherUser,
          unread_count: unreadCount || 0
        };
      })
    );

    return conversationsWithMeta;
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

export async function loadMessages(conversationId) {
  if (!store.currentUser || !conversationId) return [];
  
  const sb = getSupabase();
  
  try {
    const { data: conversation } = await sb
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation || 
        (conversation.participant_one !== store.currentUser.id && 
         conversation.participant_two !== store.currentUser.id)) {
      showToast('No tienes acceso a esta conversación', 'error');
      return [];
    }

    const { data: messages, error } = await sb
      .from('messages')
      .select(`
        *,
        sender:profiles(id, full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    await sb
      .from('messages')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', store.currentUser.id)
      .eq('read', false);

    return messages || [];
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
}

export async function sendMessage(conversationId, content, type = 'text') {
  if (!store.currentUser || !conversationId || !content?.trim()) return null;
  
  const sb = getSupabase();
  
  try {
    const { data: conversation } = await sb
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation || 
        (conversation.participant_one !== store.currentUser.id && 
         conversation.participant_two !== store.currentUser.id)) {
      showToast('No puedes enviar mensajes a esta conversación', 'error');
      return null;
    }

    const { data: message, error } = await sb
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: store.currentUser.id,
        content: content.trim(),
        type
      })
      .select('*, sender:profiles(id, full_name, avatar_url)')
      .single();

    if (error) throw error;

    const recipientId = conversation.participant_one === store.currentUser.id 
      ? conversation.participant_two 
      : conversation.participant_one;

    await sb
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    await sb
      .from('notifications')
      .insert({
        user_id: recipientId,
        type: 'new_message',
        title: 'Nuevo mensaje',
        message: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        data: { conversation_id: conversationId }
      });

    return message;
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Error al enviar mensaje', 'error');
    return null;
  }
}

export async function createConversation(participantId, jobId = null) {
  if (!store.currentUser || !participantId) return null;
  
  const sb = getSupabase();
  
  try {
    const { data: existing } = await sb
      .from('conversations')
      .select('*')
      .or(`and(participant_one.eq.${store.currentUser.id},participant_two.eq.${participantId}),and(participant_one.eq.${participantId},participant_two.eq.${store.currentUser.id})`)
      .maybeSingle();

    if (existing) {
      return { conversation: existing, exists: true };
    }

    const { data: conversation, error } = await sb
      .from('conversations')
      .insert({
        participant_one: store.currentUser.id,
        participant_two: participantId,
        job_id: jobId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return { conversation, exists: false };
  } catch (error) {
    console.error('Error creating conversation:', error);
    return null;
  }
}

export function renderConversationList(conversations) {
  const container = document.getElementById('chat-conversations');
  if (!container) return;

  if (!conversations || conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px 20px;">
        <i class="fa fa-comments"></i>
        <p>No tienes conversaciones</p>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const other = conv.other_user;
    const initials = other?.full_name 
      ? other.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
      : '??';
    const avatar = other?.avatar_url || '';
    const isActive = currentConversationId === conv.id ? 'active' : '';

    return `
      <div class="chat-conv-item ${isActive}" onclick="window.openConversation('${conv.id}')">
        <div class="chat-conv-avatar" style="${avatar ? `background-image: url(${avatar}); background-size: cover;` : ''}">
          ${!avatar ? initials : ''}
        </div>
        <div class="chat-conv-info">
          <div class="chat-conv-name">${other?.full_name || 'Usuario'}</div>
          <div class="chat-conv-last">${conv.last_message_preview || 'Sin mensajes'}</div>
        </div>
        ${conv.unread_count > 0 ? `<span class="notif-count" style="position:relative;top:0;right:0;">${conv.unread_count}</span>` : ''}
      </div>
    `;
  }).join('');
}

export function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px;">
        <i class="fa fa-comments"></i>
        <p>No hay mensajes aún</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isSent = msg.sender_id === store.currentUser?.id;
    const time = msg.created_at 
      ? new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : '';

    return `
      <div class="msg ${isSent ? 'sent' : 'received'}">
        <div class="msg-bubble">${escapeHtml(msg.content)}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

export async function openConversation(conversationId) {
  currentConversationId = conversationId;
  
  const messages = await loadMessages(conversationId);
  renderMessages(messages);

  const conversations = await loadConversations();
  renderConversationList(conversations);
}

export function sendChatMsg(event) {
  if (event.key === 'Enter') {
    sendChatMsgBtn();
  }
}

export async function sendChatMsgBtn() {
  const input = document.getElementById('chat-input-field');
  const msg = input?.value?.trim();
  
  if (!msg || !currentConversationId) return;

  input.value = '';

  const message = await sendMessage(currentConversationId, msg);
  
  if (message) {
    const messages = await loadMessages(currentConversationId);
    renderMessages(messages);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export async function startChatWithPro(proId, proName) {
  const result = await createConversation(proId);
  
  if (result?.conversation) {
    showPage('chat');
    await openConversation(result.conversation.id);
    
    if (!result.exists) {
      showToast(`Conversación iniciada con ${proName}`, 'success');
    }
  }
}

export function initChatEvents() {
  const chatInput = document.getElementById('chat-input-field');
  if (chatInput) {
    chatInput.addEventListener('keypress', sendChatMsg);
  }

  const sendBtn = document.getElementById('btn-send-chat');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendChatMsgBtn);
  }
}

export async function loadChatPage() {
  if (!store.currentUser) {
    showToast('Debes iniciar sesión para ver tus mensajes', 'info');
    return;
  }

  const conversations = await loadConversations();
  renderConversationList(conversations);

  if (conversations.length > 0) {
    await openConversation(conversations[0].id);
  }
}

window.startChatWithPro = startChatWithPro;
window.openConversation = openConversation;

// Alias para abrir chat con cualquier user_id (pro o cliente)
export async function openChatWith(userId) {
  if (!store.currentUser) {
    const { showModal } = await import('./ui.js');
    showModal('modal-login');
    return;
  }
  if (userId === store.currentUser.id) {
    const { showToast } = await import('./ui.js');
    showToast('No podés chatear con vos mismo.', 'warning');
    return;
  }
  const { showPage } = await import('./ui.js');
  showPage('chat');
  await startChatWithPro(userId, '');
}
