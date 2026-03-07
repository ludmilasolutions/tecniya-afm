import { formatTime } from './utils.js';

export function sendChatMsg(e) {
  if (e.key === 'Enter') {
    sendChatMsgBtn();
  }
}

export function sendChatMsgBtn() {
  const input = document.getElementById('chat-input-field');
  if (!input) return;
  
  const msg = input.value.trim();
  if (!msg) return;
  
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  
  const now = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  msgs.innerHTML += `<div class="msg sent"><div class="msg-bubble">${msg}</div><div class="msg-time">${now}</div></div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
}

export async function loadConversations() {
  // Placeholder for loading conversations from database
  // Currently showing mock data in HTML
}

export function initChatEvents() {
  const chatInput = document.getElementById('chat-input-field');
  if (chatInput) {
    chatInput.addEventListener('keypress', sendChatMsg);
  }
  
  const sendBtn = document.querySelector('#page-chat .chat-input-bar .btn-sm');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendChatMsgBtn);
  }
}
