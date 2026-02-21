// ============================================
//  FOODBRIDGE — recipient.js
//  Browse & claim available food listings
// ============================================

import { auth, db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Store all listings for filtering
let allListings = [];

// ============================================
//  LOAD LISTINGS — Fetch available food
// ============================================
window.loadListings = function() {
  const gridEl = document.getElementById('food-listings-grid');
  if (!gridEl) return;

  gridEl.innerHTML = '<p class="empty-msg">⏳ Loading available food...</p>';

  // Real-time listener for available listings
  const q = query(
    collection(db, 'foodListings'),
    where('status', '==', 'available'),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(q, (snapshot) => {
    allListings = [];

    if (snapshot.empty) {
      gridEl.innerHTML = `
        <div class="no-listings">
          <p style="font-size:3rem">🍽️</p>
          <p>No food available right now.</p>
          <p style="font-size:0.85rem; margin-top:8px">
            Check back soon or be the first to donate!
          </p>
        </div>`;
      return;
    }

    snapshot.forEach(docSnap => {
      allListings.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderListings(allListings);
  });
};

// ============================================
//  RENDER LISTINGS — Build listing cards
// ============================================
function renderListings(listings) {
  const gridEl = document.getElementById('food-listings-grid');
  if (!gridEl) return;

  if (listings.length === 0) {
    gridEl.innerHTML = `
      <div class="no-listings">
        <p style="font-size:3rem">🔍</p>
        <p>No listings match your filter.</p>
      </div>`;
    return;
  }

  gridEl.innerHTML = '';
  listings.forEach(item => {
    gridEl.appendChild(createListingCard(item));
  });
}

// ============================================
//  CREATE LISTING CARD — Build HTML card
// ============================================
function createListingCard(data) {
  const card = document.createElement('div');
  card.className = 'listing-card';

  const expiry   = data.expiryDate?.toDate();
  const now      = new Date();
  const daysLeft = expiry
    ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
    : null;

  // Time left badge
  let timeBadge = '';
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      timeBadge = `<span class="time-left time-urgent">Expired</span>`;
    } else if (daysLeft === 0) {
      timeBadge = `<span class="time-left time-urgent">⚡ Today only!</span>`;
    } else if (daysLeft <= 2) {
      timeBadge = `<span class="time-left time-urgent">⚡ ${daysLeft} day(s) left</span>`;
    } else {
      timeBadge = `<span class="time-left time-ok">✅ ${daysLeft} days left</span>`;
    }
  }

  // Category emoji
  const categoryEmojis = {
    veg: '🥦', nonveg: '🍗', bakery: '🍞',
    dairy: '🥛', fruits: '🍎', cooked: '🍲', packaged: '📦'
  };
  const emoji = categoryEmojis[data.category] || '🍱';

  // Pickup window
  const pickupText = data.pickupStart
    ? `${formatDateTime(data.pickupStart.toDate())} — ${formatDateTime(data.pickupEnd?.toDate())}`
    : 'Flexible pickup time';

  card.innerHTML = `
    <div class="listing-card-header">
      <h3>${data.foodName}</h3>
      <span class="quantity-badge">
        ${data.quantity} ${data.unit}
      </span>
    </div>

    <span class="category-badge">
      ${emoji} ${data.category}
    </span>

    ${timeBadge}

    <div class="listing-detail">
      <span>📍</span>
      <span>${data.location}</span>
    </div>

    <div class="listing-detail">
      <span>🕐</span>
      <span>${pickupText}</span>
    </div>

    ${data.notes ? `
    <div class="listing-detail">
      <span>📝</span>
      <span>${data.notes}</span>
    </div>` : ''}

    <div class="donor-info">
      👤 Posted by ${data.donorName || 'Anonymous'}
    </div>

    <button
      class="btn-claim"
      id="claim-btn-${data.id}"
      onclick="claimFood('${data.id}', '${data.donorId}')">
      🤝 Claim This Food
    </button>
  `;

  return card;
}

// ============================================
//  CLAIM FOOD — Reserve a listing
// ============================================
window.claimFood = async function(listingId, donorId) {
  // Must be logged in
  if (!window.currentUser) {
    alert('Please login or sign up to claim food!');
    showPage('auth');
    return;
  }

  // Donors cannot claim their own food
  if (window.currentUser.uid === donorId) {
    alert('You cannot claim your own food listing!');
    return;
  }

  const btn = document.getElementById(`claim-btn-${listingId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Claiming...';
  }

  try {
    // Update listing status to claimed
    await updateDoc(doc(db, 'foodListings', listingId), {
      status:      'claimed',
      claimedBy:   window.currentUser.uid,
      claimedName: window.currentUserData?.name || window.currentUser.email,
      claimedAt:   serverTimestamp()
    });

    // Add to claims collection
    await addDoc(collection(db, 'claims'), {
      listingId:     listingId,
      recipientId:   window.currentUser.uid,
      recipientName: window.currentUserData?.name || window.currentUser.email,
      donorId:       donorId,
      claimedAt:     serverTimestamp(),
      status:        'claimed'
    });

    if (btn) {
      btn.textContent   = '✅ Claimed!';
      btn.className     = 'btn-claim btn-claimed';
      btn.disabled      = true;
    }

    // Show success message
    showClaimSuccess(listingId);

  } catch (error) {
    console.error('Claim error:', error);
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '🤝 Claim This Food';
    }
    alert('Could not claim food. Please try again.');
  }
};

// ============================================
//  FILTER LISTINGS — by category
// ============================================
window.filterListings = function() {
  const category = document.getElementById('filter-category').value;

  if (!category) {
    renderListings(allListings);
  } else {
    const filtered = allListings.filter(
      item => item.category === category
    );
    renderListings(filtered);
  }
};

// ============================================
//  SHOW CLAIM SUCCESS — Banner after claiming
// ============================================
function showClaimSuccess(listingId) {
  const card = document
    .getElementById(`claim-btn-${listingId}`)
    ?.closest('.listing-card');

  if (card) {
    const banner = document.createElement('div');
    banner.className = 'claimed-banner';
    banner.innerHTML = `
      🎉 You claimed this food!
      Please pick it up at the listed location
      during the pickup window.
    `;
    card.appendChild(banner);
  }
}

// ============================================
//  HELPER — Format date nicely
// ============================================
function formatDateTime(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', {
    day:    'numeric',
    month:  'short',
    hour:   '2-digit',
    minute: '2-digit'
  });
}