// ============================================
//  nourishh — recipient.js
//  Browse & claim available food listings
// ============================================

import { auth, db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  getDoc,
  setDoc,
  increment
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

  const q = query(
    collection(db, 'foodListings'),
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

    // Update map with new listings
    if (typeof updateMapListings === 'function') {
      updateMapListings(allListings);
    }
  });
};

// ============================================
//  RENDER LISTINGS
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
//  CREATE LISTING CARD — Now with photo!
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
    dairy: '🥛', fruits: '🍎', cooked: '🍲',
    packaged: '📦'
  };
  const emoji = categoryEmojis[data.category] || '🍱';

  // Pickup window
  const pickupText = data.pickupStart
    ? `${formatDateTime(data.pickupStart.toDate())} — 
       ${formatDateTime(data.pickupEnd?.toDate())}`
    : 'Flexible pickup time';

  // Photo section — show if available
  const photoHTML = data.photo
    ? `<div class="listing-photo-container">
        <img
          src="${data.photo}"
          alt="Food photo"
          class="listing-photo"
        />
        <span class="live-photo-badge">📸 Live Photo</span>
       </div>`
    : `<div class="listing-no-photo">
        <span>🍱</span>
        <p>No photo</p>
       </div>`;

  card.innerHTML = `
    ${photoHTML}

    <div class="listing-card-body">
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

      ${data.status === 'available' ? `
      <button
        class="btn-claim"
        id="claim-btn-${data.id}"
        onclick="claimFood('${data.id}', '${data.donorId}')">
        🤝 Claim This Food
      </button>` : ''}

      ${data.status === 'claimed' &&
        data.claimedBy === window.currentUser?.uid ? `
      <div class="claimed-banner">
        🎉 You claimed this food! Chat to coordinate pickup.
      </div>
      <button
        class="btn-open-chat"
        onclick="openChat(
          '${data.id}',
          '${data.foodName}',
          '${data.donorName}')">
        💬 Chat with Donor
      </button>` : ''}

      ${data.status === 'claimed' &&
        data.claimedBy !== window.currentUser?.uid &&
        data.status !== 'available' ? `
      <button class="btn-claim btn-claimed" disabled>
        Already Claimed
      </button>` : ''}
    </div>
  `;

  return card;
}

// ============================================
//  CLAIM FOOD
// ============================================
window.claimFood = async function(listingId, donorId) {
  if (!window.currentUser) {
    alert('Please login or sign up to claim food!');
    showPage('auth');
    return;
  }

  // Check if email is verified
  if (!window.currentUser.emailVerified) {
    alert('⚠️ Please verify your email before claiming food!');
    return;
  }

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
    await updateDoc(doc(db, 'foodListings', listingId), {
      status:      'claimed',
      claimedBy:   window.currentUser.uid,
      claimedName: window.currentUserData?.name || window.currentUser.email,
      claimedAt:   serverTimestamp()
    });

    await addDoc(collection(db, 'claims'), {
      listingId:     listingId,
      recipientId:   window.currentUser.uid,
      recipientName: window.currentUserData?.name || window.currentUser.email,
      donorId:       donorId,
      claimedAt:     serverTimestamp(),
      status:        'claimed'
    });

    // ---- Update stats only when food is CLAIMED ----
    // Get listing details for quantity
    const listingDoc = await getDoc(doc(db, 'foodListings', listingId));
    if (listingDoc.exists()) {
      const listingData = listingDoc.data();
      const kg          = listingData.quantity || 1;

      // Update global stats
      await updateClaimedStats(kg, donorId);
    }

    if (btn) {
      btn.textContent = '✅ Claimed!';
      btn.className   = 'btn-claim btn-claimed';
      btn.disabled    = true;
    }

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
//  FILTER LISTINGS
// ============================================
window.filterListings = function() {
  const category = document.getElementById('filter-category').value;
  const expiry   = document.getElementById('filter-expiry').value;
  const search   = document.getElementById('search-input')
                    ?.value.toLowerCase().trim();

  let filtered = [...allListings];

  // ---- Filter by category ----
  if (category) {
    filtered = filtered.filter(
      item => item.category === category
    );
  }

  // ---- Filter by expiry ----
  if (expiry) {
    const now = new Date();
    filtered = filtered.filter(item => {
      const expiryDate = item.expiryDate?.toDate();
      if (!expiryDate) return false;
      const daysLeft = Math.ceil(
        (expiryDate - now) / (1000 * 60 * 60 * 24)
      );

      if (expiry === 'today')  return daysLeft === 0;
      if (expiry === 'urgent') return daysLeft >= 1 && daysLeft <= 2;
      if (expiry === 'week')   return daysLeft >= 0 && daysLeft <= 7;
      return true;
    });
  }

  // ---- Filter by search ----
  if (search) {
    filtered = filtered.filter(item =>
      item.foodName?.toLowerCase().includes(search) ||
      item.location?.toLowerCase().includes(search) ||
      item.donorName?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search)
    );
  }

  renderListings(filtered);

  // Update map too
  if (typeof updateMapListings === 'function') {
    updateMapListings(filtered);
  }
};

// ---- Reset all filters ----
window.resetFilters = function() {
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-expiry').value   = '';
  const searchEl = document.getElementById('search-input');
  if (searchEl) searchEl.value = '';
  renderListings(allListings);
  if (typeof updateMapListings === 'function') {
    updateMapListings(allListings);
  }
};

// ============================================
//  SHOW CLAIM SUCCESS
// ============================================
function showClaimSuccess(listingId) {
  const card = document
    .getElementById(`claim-btn-${listingId}`)
    ?.closest('.listing-card');

  if (card) {
    const banner = document.createElement('div');
    banner.className = 'claimed-banner';
    banner.innerHTML = `
      🎉 You claimed this food! Chat with the donor
      to coordinate pickup details.
    `;
    card.appendChild(banner);
  }

  // Show chat button
  const chatBtn = document.getElementById(`chat-btn-${listingId}`);
  if (chatBtn) chatBtn.classList.remove('hidden');
}

// ============================================
//  HELPER — Format date
// ============================================
function formatDateTime(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', {
    day:    'numeric',
    month:  'short',
    hour:   '2-digit',
    minute: '2-digit'
  });
  // ============================================
//  UPDATE STATS ON CLAIM
// ============================================
async function updateClaimedStats(kg, donorId) {
  const meals = Math.round(kg * 4);
  const co2   = Math.round(kg * 2.5);
  const water = Math.round(kg * 250);

  try {
    // Update global stats
    await setDoc(doc(db, 'stats', 'global'), {
      totalKg:     increment(kg),
      totalMeals:  increment(meals),
      totalCo2:    increment(co2),
      totalDonors: increment(1)
    }, { merge: true });

    // Update donor's personal stats
    await setDoc(doc(db, 'userStats', donorId), {
      totalKg:    increment(kg),
      totalMeals: increment(meals),
      totalCo2:   increment(co2),
      totalWater: increment(water),
      donations:  increment(1)
    }, { merge: true });

  } catch(e) {
    console.log('Stats update error:', e);
  }
}
}