// ============================================
//  FOODBRIDGE — tracker.js
//  Expiry tracker for groceries
// ============================================

import { auth, db } from './firebase-config.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
//  ADD TRACKER ITEM — Save grocery item
// ============================================
window.addTrackerItem = async function() {
  // Must be logged in
  if (!window.currentUser) {
    alert('Please login to use the expiry tracker!');
    showPage('auth');
    return;
  }

  const name     = document.getElementById('item-name').value.trim();
  const quantity = document.getElementById('item-quantity').value;
  const unit     = document.getElementById('item-unit').value.trim();
  const expiry   = document.getElementById('item-expiry').value;
  const msgEl    = document.getElementById('tracker-msg');

  // --- Validation ---
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

  msgEl.style.color = 'var(--green)';
  msgEl.textContent = '⏳ Adding item...';

  try {
    // Save to Firestore under user's tracker collection
    await addDoc(
      collection(db, 'tracker', window.currentUser.uid, 'items'),
      {
        name:      name,
        quantity:  quantity || '1',
        unit:      unit || 'pcs',
        expiryDate: new Date(expiry),
        addedAt:   serverTimestamp()
      }
    );

    msgEl.textContent = '✅ Item added successfully!';

    // Clear form
    document.getElementById('item-name').value     = '';
    document.getElementById('item-quantity').value = '';
    document.getElementById('item-unit').value     = '';
    document.getElementById('item-expiry').value   = '';

    setTimeout(() => { msgEl.textContent = ''; }, 2000);

  } catch (error) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Error adding item. Try again.';
    console.error('Tracker add error:', error);
  }
};

// ============================================
//  LOAD TRACKER ITEMS — Show grocery list
// ============================================
window.loadTrackerItems = function() {
  if (!window.currentUser) return;

  const listEl = document.getElementById('tracker-items-list');
  if (!listEl) return;

  listEl.innerHTML = '<p class="empty-msg">⏳ Loading your items...</p>';

  const q = query(
    collection(db, 'tracker', window.currentUser.uid, 'items'),
    orderBy('expiryDate', 'asc')
  );

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      listEl.innerHTML = `
        <p class="empty-msg">
          No items yet. Add your groceries above! 👆
        </p>`;
      return;
    }

    // Build summary counts
    let expiredCount  = 0;
    let urgentCount   = 0;
    let freshCount    = 0;
    const items       = [];

    snapshot.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      items.push(data);

      const daysLeft = getDaysLeft(data.expiryDate?.toDate());
      if (daysLeft < 0)       expiredCount++;
      else if (daysLeft <= 3) urgentCount++;
      else                    freshCount++;
    });

    // Build HTML
    listEl.innerHTML = '';

    // Summary pills
    const summary = document.createElement('div');
    summary.className = 'tracker-summary';
    summary.innerHTML = `
      <span class="summary-pill pill-all">
        All (${items.length})
      </span>
      ${urgentCount > 0 ? `
      <span class="summary-pill pill-urgent">
        ⚡ Urgent (${urgentCount + expiredCount})
      </span>` : ''}
      <span class="summary-pill pill-fresh">
        ✅ Fresh (${freshCount})
      </span>
    `;
    listEl.appendChild(summary);

    // Tip box
    if (urgentCount > 0 || expiredCount > 0) {
      const tip = document.createElement('div');
      tip.className = 'tip-box';
      tip.innerHTML = `
        <p>
          💡 <strong>Tip:</strong> You have
          ${urgentCount + expiredCount} item(s) expiring soon!
          Click <strong>"Donate Now"</strong> to post them
          as a food listing and help someone in need.
        </p>`;
      listEl.appendChild(tip);
    }

    // Render each item
    items.forEach(item => {
      listEl.appendChild(createTrackerCard(item));
    });
  });
};

// ============================================
//  CREATE TRACKER CARD — Build item card
// ============================================
function createTrackerCard(data) {
  const div      = document.createElement('div');
  const expiry   = data.expiryDate?.toDate();
  const daysLeft = getDaysLeft(expiry);

  // Set card class based on urgency
  let cardClass = 'tracker-item ';
  let daysLabel = '';
  let daysClass = '';
  let icon      = getFoodIcon(data.name);

  if (daysLeft < 0) {
    cardClass += 'expired';
    daysLabel  = 'Expired!';
    daysClass  = 'days-expired';
  } else if (daysLeft === 0) {
    cardClass += 'expiring-today';
    daysLabel  = 'Expires Today!';
    daysClass  = 'days-today';
  } else if (daysLeft <= 3) {
    cardClass += 'expiring-soon';
    daysLabel  = `${daysLeft} day(s) left`;
    daysClass  = 'days-soon';
  } else {
    cardClass += 'fresh';
    daysLabel  = `${daysLeft} days left`;
    daysClass  = 'days-fresh';
  }

  // Show donate button if expiring within 3 days
  const donateBtn = daysLeft <= 3
    ? `<button
        class="btn-donate-now"
        onclick="quickDonate('${data.name}', '${data.quantity}', '${data.unit}')">
        Donate Now 🍱
       </button>`
    : '';

  div.className = cardClass;
  div.innerHTML = `
    <div class="tracker-item-icon">${icon}</div>

    <div class="tracker-item-info">
      <h4>${data.name}</h4>
      <p>📦 ${data.quantity} ${data.unit}</p>
      <p>📅 Expires: ${formatDate(expiry)}</p>
    </div>

    <div class="tracker-item-actions">
      <span class="days-left ${daysClass}">${daysLabel}</span>
      ${donateBtn}
      <button
        class="btn-remove-item"
        onclick="removeTrackerItem('${data.id}')">
        🗑️
      </button>
    </div>
  `;

  return div;
}

// ============================================
//  REMOVE TRACKER ITEM
// ============================================
window.removeTrackerItem = async function(itemId) {
  if (!window.currentUser) return;
  if (!confirm('Remove this item from your tracker?')) return;

  try {
    await deleteDoc(
      doc(db, 'tracker', window.currentUser.uid, 'items', itemId)
    );
  } catch (error) {
    console.error('Remove tracker item error:', error);
    alert('Could not remove item. Please try again.');
  }
};

// ============================================
//  QUICK DONATE — Jump to donor form
//  Pre-fills the form with tracker item data
// ============================================
window.quickDonate = function(name, quantity, unit) {
  showPage('donor');

  // Pre-fill donor form
  setTimeout(() => {
    const nameEl  = document.getElementById('food-name');
    const qtyEl   = document.getElementById('food-quantity');
    const unitEl  = document.getElementById('food-unit');
    const msgEl   = document.getElementById('donor-msg');

    if (nameEl)  nameEl.value  = name;
    if (qtyEl)   qtyEl.value   = quantity;
    if (unitEl)  unitEl.value  = unit;
    if (msgEl) {
      msgEl.style.color = 'var(--green)';
      msgEl.textContent =
        '✅ Form pre-filled from your tracker! Add more details and post.';
    }

    // Scroll to form
    document.getElementById('donor-form-card')
      ?.scrollIntoView({ behavior: 'smooth' });
  }, 300);
};

// ============================================
//  HELPER — Get days left until expiry
// ============================================
function getDaysLeft(date) {
  if (!date) return 999;
  const now      = new Date();
  now.setHours(0, 0, 0, 0);
  const expDate  = new Date(date);
  expDate.setHours(0, 0, 0, 0);
  return Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
}

// ============================================
//  HELPER — Format date
// ============================================
function formatDate(date) {
  if (!date) return 'Unknown';
  return date.toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric'
  });
}

// ============================================
//  HELPER — Get food icon by name
// ============================================
function getFoodIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('milk') || n.includes('dairy'))  return '🥛';
  if (n.includes('bread') || n.includes('roti'))  return '🍞';
  if (n.includes('rice'))                         return '🍚';
  if (n.includes('egg'))                          return '🥚';
  if (n.includes('fruit') || n.includes('apple')) return '🍎';
  if (n.includes('veg') || n.includes('sabzi'))   return '🥦';
  if (n.includes('chicken') || n.includes('meat'))return '🍗';
  if (n.includes('fish'))                         return '🐟';
  if (n.includes('dal') || n.includes('lentil'))  return '🫘';
  if (n.includes('oil'))                          return '🫙';
  return '🥫';
}