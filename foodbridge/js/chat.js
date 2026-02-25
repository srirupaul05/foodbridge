// ============================================
//  FOODBRIDGE — chat.js
//  Real-time chat between donor & recipient
// ============================================

import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- Global chat state ----
let currentChatId    = null;
let currentChatName  = null;
let messagesListener = null;

// ============================================
//  OPEN CHAT
// ============================================
window.openChat = async function(chatId, chatTitle, otherPersonName) {
  if (!window.currentUser) {
    alert('Please login to use chat!');
    showPage('auth');
    return;
  }

  currentChatId   = chatId;
  currentChatName = chatTitle;

  // Update chat header
  document.getElementById('chat-title').textContent =
    `💬 ${chatTitle}`;
  document.getElementById('chat-subtitle').textContent =
    `Chatting with ${otherPersonName}`;

  // Show modal
  const modal = document.getElementById('chat-modal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // prevent background scroll

  // Create chat room if doesn't exist
  await ensureChatExists(chatId, chatTitle);

  // Load messages
  loadMessages(chatId);

  // Focus input
  setTimeout(() => {
    document.getElementById('chat-input')?.focus();
  }, 300);
};

// ============================================
//  CLOSE CHAT
// ============================================
window.closeChat = function() {
  const modal = document.getElementById('chat-modal');
  modal.classList.add('hidden');
  document.body.style.overflow = '';

  // Stop listening to messages
  if (messagesListener) {
    messagesListener();
    messagesListener = null;
  }

  currentChatId   = null;
  currentChatName = null;

  // Clear messages
  document.getElementById('chat-messages').innerHTML =
    '<p class="chat-loading">⏳ Loading messages...</p>';
};

// ============================================
//  ENSURE CHAT EXISTS — Create if new
// ============================================
async function ensureChatExists(chatId, title) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) {
      // Create new chat room
      await setDoc(chatRef, {
        title:     title,
        createdAt: serverTimestamp(),
        createdBy: window.currentUser.uid
      });

      // Add system welcome message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text:       '🌱 Chat started! Coordinate your food pickup here.',
        senderId:   'system',
        senderName: 'FoodBridge',
        sentAt:     serverTimestamp(),
        type:       'system'
      });
    }
  } catch (e) {
    console.error('Chat creation error:', e);
  }
}

// ============================================
//  LOAD MESSAGES — Real-time listener
// ============================================
function loadMessages(chatId) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  // Stop previous listener
  if (messagesListener) {
    messagesListener();
  }

  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('sentAt', 'asc')
  );

  messagesListener = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      messagesEl.innerHTML = `
        <div class="chat-empty">
          <p>💬</p>
          <p>No messages yet. Say hello!</p>
        </div>`;
      return;
    }

    messagesEl.innerHTML = '';

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      messagesEl.appendChild(createMessageBubble(data));
    });

    // Scroll to bottom
    scrollToBottom();
  });
}

// ============================================
//  CREATE MESSAGE BUBBLE
// ============================================
function createMessageBubble(data) {
  const div = document.createElement('div');

  // System message
  if (data.type === 'system' || data.senderId === 'system') {
    div.className = 'message-system';
    div.textContent = data.text;
    return div;
  }

  // My message or their message
  const isMe = data.senderId === window.currentUser?.uid;
  div.className = `message-bubble ${isMe ? 'message-mine' : 'message-theirs'}`;

  const time = data.sentAt?.toDate
    ? formatTime(data.sentAt.toDate())
    : '';

  div.innerHTML = `
    <div class="message-sender">
      ${isMe ? 'You' : data.senderName}
    </div>
    <div class="message-text">${escapeHtml(data.text)}</div>
    <div class="message-time">${time}</div>
  `;

  return div;
}

// ============================================
//  SEND MESSAGE
// ============================================
window.sendMessage = async function() {
  if (!currentChatId || !window.currentUser) return;

  const input = document.getElementById('chat-input');
  const text  = input.value.trim();

  if (!text) return;

  // Clear input immediately
  input.value = '';

  try {
    await addDoc(
      collection(db, 'chats', currentChatId, 'messages'),
      {
        text:       text,
        senderId:   window.currentUser.uid,
        senderName: window.currentUserData?.name ||
                    window.currentUser.email,
        sentAt:     serverTimestamp(),
        type:       'message'
      }
    );

    scrollToBottom();

  } catch (error) {
    console.error('Send message error:', error);
    input.value = text; // restore if failed
    alert('Could not send message. Please try again.');
  }
};

// ============================================
//  HANDLE ENTER KEY
// ============================================
window.handleChatKeyPress = function(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
};

// ============================================
//  CLOSE CHAT ON OUTSIDE CLICK
// ============================================
document.addEventListener('click', (e) => {
  const modal = document.getElementById('chat-modal');
  if (modal && !modal.classList.contains('hidden')) {
    if (e.target === modal) {
      closeChat();
    }
  }
});

// ============================================
//  HELPERS
// ============================================
function scrollToBottom() {
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    setTimeout(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 50);
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}