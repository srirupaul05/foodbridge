// ============================================
//  nourishh — tracker.js
//  Expiry tracker with notifications & sorting
// ============================================

import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- Global state ----
let allTrackerItems = [];
let currentSort     = 'soonest';

// ---- Category emojis ----
const categoryEmojis = {
  dairy:      '🥛',
  vegetables: '🥦',
  fruits:     '🍎',
  meat:       '🍗',
  bakery:     '🍞',
  packaged:   '📦',
  leftovers:  '🍲',
  other:      '📋'
};

// ============================================
//  LOAD TRACKER ITEMS
// ============================================
window.loadTrackerItems = async function() {
  if (!window.currentUser) return;

  const listEl = document.getElementById('tracker-items-list');
  if (!listEl) return;

  listEl.innerHTML = '<p class="empty-msg">⏳ Loading items...</p>';

  try {
    const q = query(
      collection(db, 'tracker', window.currentUser.uid, 'items'),
      orderBy('expiryDate', 'asc')
    );

    const snapshot = await getDocs(q);
    allTrackerItems = [];

    snapshot.forEach(docSnap => {
      allTrackerItems.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderTrackerItems(allTrackerItems);
    updateExpirySummary(allTrackerItems);
    showExpiryNotifications(allTrackerItems);

  } catch (e) {
    listEl.innerHTML =
      '<p class="empty-msg">Could not load items.</p>';
    console.error('Tracker load error:', e);
  }
};

// ============================================
//  ADD TRACKER ITEM
// ============================================
window.addTrackerItem = async function() {
  if (!window.currentUser) {
    alert('Please login to use the tracker!');
    showPage('auth');
    return;
  }

  const name     = document.getElementById('item-name').value.trim();
  const quantity = document.getElementById('item-quantity').value;
  const unit     = document.getElementById('item-unit').value.trim();
  const category = document.getElementById('item-category').value;
  const expiry   = document.getElementById('item-expiry').value;
  const msgEl    = document.getElementById('tracker-msg');

  // Validation
  if (!name) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter item name.';
    return;
  }
  if (!expiry) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter expiry date.';
    return;
  }

  // Check expiry not in past
  const expiryDate = new Date(expiry);
  const today      = new Date();
  today.setHours(0, 0, 0, 0);

  msgEl.style.color = 'var(--green)';
  msgEl.textContent = '⏳ Adding item...';

  try {
    await addDoc(
      collection(db, 'tracker', window.currentUser.uid, 'items'),
      {
        name:        name,
        quantity:    parseFloat(quantity) || 1,
        unit:        unit || 'pcs',
        category:    category || 'other',
        expiryDate:  expiryDate,
        addedAt:     serverTimestamp()
      }
    );

    msgEl.textContent = '✅ Item added!';

    // Clear form
    document.getElementById('item-name').value     = '';
    document.getElementById('item-quantity').value = '';
    document.getElementById('item-unit').value     = '';
    document.getElementById('item-category').value = '';
    document.getElementById('item-expiry').value   = '';

    // Reload items
    await loadTrackerItems();

    setTimeout(() => { msgEl.textContent = ''; }, 2000);

  } catch (e) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Could not add item.';
    console.error(e);
  }
};

// ============================================
//  RENDER TRACKER ITEMS
// ============================================
function renderTrackerItems(items) {
  const listEl = document.getElementById('tracker-items-list');
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <p style="font-size:3rem">🛒</p>
        <p style="color:var(--gray)">
          No items yet. Add your groceries!
        </p>
      </div>`;
    return;
  }

  // Sort items
  const sorted = [...items].sort((a, b) => {
    const dateA = getExpiryDate(a);
    const dateB = getExpiryDate(b);
    return currentSort === 'soonest'
      ? dateA - dateB
      : dateB - dateA;
  });

  listEl.innerHTML = '';
  sorted.forEach(item => {
    listEl.appendChild(createTrackerCard(item));
  });
}

// ============================================
//  CREATE TRACKER CARD
// ============================================
function createTrackerCard(item) {
  const div        = document.createElement('div');
  const expiryDate = getExpiryDate(item);
  const now        = new Date();
  now.setHours(0, 0, 0, 0);

  const daysLeft   = Math.ceil(
    (expiryDate - now) / (1000 * 60 * 60 * 24)
  );

  // Determine status
  let status, daysText, freshnessWidth;

  if (daysLeft < 0) {
    status         = 'expired';
    daysText       = `Expired ${Math.abs(daysLeft)} days ago`;
    freshnessWidth = 100;
  } else if (daysLeft === 0) {
    status         = 'urgent';
    daysText       = '⚡ Expires TODAY!';
    freshnessWidth = 95;
  } else if (daysLeft <= 2) {
    status         = 'urgent';
    daysText       = `🔴 ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`;
    freshnessWidth = 75;
  } else if (daysLeft <= 5) {
    status         = 'warning';
    daysText       = `⚠️ ${daysLeft} days left`;
    freshnessWidth = 50;
  } else {
    status         = 'fresh';
    daysText       = `✅ ${daysLeft} days left`;
    freshnessWidth = Math.max(10, 100 - (daysLeft * 3));
  }

  const emoji = categoryEmojis[item.category] || '📋';

  div.className = `tracker-item ${status}`;
  div.innerHTML = `
    <div class="item-emoji">${emoji}</div>

    <div class="item-info">
      <h4>${item.name}</h4>
      <p class="item-meta">
        ${item.quantity} ${item.unit}
        ${item.category ? `• ${item.category}` : ''}
      </p>
      <div class="freshness-bar">
        <div class="freshness-fill"
             style="width:${freshnessWidth}%"></div>
      </div>
      <span class="days-left">${daysText}</span>
    </div>

    <div class="item-actions">
      ${daysLeft <= 3 ? `
      <button
        class="btn-donate-item"
        onclick="donateTrackerItem(
          '${item.name}',
          '${item.quantity}',
          '${item.unit}',
          '${item.category}')">
        🍱 Donate
      </button>` : ''}
      <button
        class="btn-delete-item"
        onclick="deleteTrackerItem('${item.id}')">
        🗑️ Remove
      </button>
    </div>
  `;

  return div;
}

// ============================================
//  DELETE TRACKER ITEM
// ============================================
window.deleteTrackerItem = async function(itemId) {
  if (!confirm('Remove this item?')) return;
  try {
    await deleteDoc(
      doc(db, 'tracker', window.currentUser.uid, 'items', itemId)
    );
    await loadTrackerItems();
  } catch (e) {
    showToast('Could not remove item.', 'error');
    console.error(e);
  }
};

// ============================================
//  DONATE TRACKER ITEM — Pre-fill donor form
// ============================================
window.donateTrackerItem = function(name, quantity, unit, category) {
  // Switch to donor page
  showPage('donor');

  // Pre-fill the form
  setTimeout(() => {
    const nameEl     = document.getElementById('food-name');
    const quantityEl = document.getElementById('food-quantity');
    const unitEl     = document.getElementById('food-unit');
    const categoryEl = document.getElementById('food-category');

    if (nameEl)     nameEl.value     = name;
    if (quantityEl) quantityEl.value = quantity;
    if (unitEl)     unitEl.value     = unit;

    // Match category
    const categoryMap = {
      dairy:      'dairy',
      vegetables: 'veg',
      fruits:     'fruits',
      meat:       'nonveg',
      bakery:     'bakery',
      packaged:   'packaged',
      leftovers:  'cooked'
    };
    if (categoryEl && categoryMap[category]) {
      categoryEl.value = categoryMap[category];
    }

    // Scroll to form
    document.getElementById('donor-form-card')
      ?.scrollIntoView({ behavior: 'smooth' });

    // Show hint
    const msgEl = document.getElementById('donor-msg');
    if (msgEl) {
      msgEl.style.color = 'var(--green)';
      msgEl.textContent =
        '✅ Form pre-filled from your expiry tracker!';
    }
  }, 300);
};

// ============================================
//  SORT ITEMS
// ============================================
window.sortItems = function(sort) {
  currentSort = sort;

  // Update button styles
  document.querySelectorAll('.btn-sort').forEach(btn => {
    btn.classList.remove('active');
  });

  if (sort === 'soonest') {
    document.getElementById('sort-soonest')
      ?.classList.add('active');
  } else {
    document.getElementById('sort-latest')
      ?.classList.add('active');
  }

  renderTrackerItems(allTrackerItems);
};

// ============================================
//  EXPIRY SUMMARY
// ============================================
function updateExpirySummary(items) {
  const summaryEl = document.getElementById('expiry-summary');
  if (!summaryEl) return;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let expired = 0, urgent = 0, fresh = 0;

  items.forEach(item => {
    const expiryDate = getExpiryDate(item);
    const daysLeft   = Math.ceil(
      (expiryDate - now) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft < 0)      expired++;
    else if (daysLeft <= 3) urgent++;
    else                    fresh++;
  });

  summaryEl.innerHTML = `
    ${expired > 0 ? `
    <span class="summary-badge expired">
      ❌ ${expired} Expired
    </span>` : ''}
    ${urgent > 0 ? `
    <span class="summary-badge urgent">
      ⚠️ ${urgent} Expiring Soon
    </span>` : ''}
    ${fresh > 0 ? `
    <span class="summary-badge fresh">
      ✅ ${fresh} Fresh
    </span>` : ''}
    ${items.length === 0 ? `
    <span style="color:var(--gray);font-size:0.85rem">
      No items tracked yet
    </span>` : ''}
  `;
}

// ============================================
//  SHOW EXPIRY NOTIFICATIONS
// ============================================
function showExpiryNotifications(items) {
  const banner  = document.getElementById('tracker-notif-banner');
  const textEl  = document.getElementById('tracker-notif-text');
  if (!banner || !textEl) return;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let expiredItems  = [];
  let urgentItems   = [];

  items.forEach(item => {
    const expiryDate = getExpiryDate(item);
    const daysLeft   = Math.ceil(
      (expiryDate - now) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft < 0)      expiredItems.push(item.name);
    else if (daysLeft <= 2) urgentItems.push(item.name);
  });

  if (expiredItems.length > 0) {
    banner.classList.remove('hidden');
    banner.classList.add('danger');
    textEl.textContent =
      `❌ Expired: ${expiredItems.join(', ')} — Please remove or donate!`;
  } else if (urgentItems.length > 0) {
    banner.classList.remove('hidden');
    banner.classList.remove('danger');
    textEl.textContent =
      `⚠️ Expiring soon: ${urgentItems.join(', ')} — Consider donating!`;
  } else {
    banner.classList.add('hidden');
  }

  // Browser notification
  if (
    (expiredItems.length > 0 || urgentItems.length > 0) &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification('🍃 nourishh Expiry Alert!', {
      body: expiredItems.length > 0
        ? `${expiredItems[0]} has expired!`
        : `${urgentItems[0]} expires soon!`,
      icon: '/assets/images/icon.png'
    });
  }

  // Request notification permission
  if (
    (expiredItems.length > 0 || urgentItems.length > 0) &&
    'Notification' in window &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission();
  }
}

// ============================================
//  DISMISS BANNER
// ============================================
window.dismissTrackerBanner = function() {
  const banner = document.getElementById('tracker-notif-banner');
  if (banner) banner.classList.add('hidden');
};

// ============================================
//  HELPER — Get expiry date from item
// ============================================
function getExpiryDate(item) {
  if (item.expiryDate?.toDate) {
    return item.expiryDate.toDate();
  }
  return new Date(item.expiryDate);
}