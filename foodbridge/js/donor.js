// ============================================
//  FOODBRIDGE — donor.js
//  Post food listings & manage donations
// ============================================

import { auth, db } from './firebase-config.js';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
//  POST FOOD — Add new food listing
// ============================================
window.postFood = async function() {
  // Check if user is logged in
  if (!window.currentUser) {
    showLoginPrompt('donor-form-card',
      'Please login to post food donations');
    return;
  }

  // Check if user is a donor
  if (window.currentUserData?.role === 'recipient') {
    document.getElementById('donor-msg').textContent =
      '⚠️ Recipients cannot post food. Please login as a donor.';
    return;
  }

  // Get form values
  const foodName    = document.getElementById('food-name').value.trim();
  const category    = document.getElementById('food-category').value;
  const quantity    = document.getElementById('food-quantity').value;
  const unit        = document.getElementById('food-unit').value.trim();
  const expiry      = document.getElementById('food-expiry').value;
  const pickupStart = document.getElementById('pickup-start').value;
  const pickupEnd   = document.getElementById('pickup-end').value;
  const location    = document.getElementById('food-location').value.trim();
  const notes       = document.getElementById('food-notes').value.trim();
  const msgEl       = document.getElementById('donor-msg');

  // --- Validation ---
  if (!foodName) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter food name.';
    return;
  }
  if (!category) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please select a category.';
    return;
  }
  if (!quantity || quantity <= 0) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter a valid quantity.';
    return;
  }
  if (!expiry) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter expiry date.';
    return;
  }
  if (!location) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter pickup location.';
    return;
  }

  // Show loading
  msgEl.style.color = 'var(--green)';
  msgEl.textContent = '⏳ Posting your listing...';

  try {
    // Add to Firestore foodListings collection
    await addDoc(collection(db, 'foodListings'), {
      donorId:       window.currentUser.uid,
      donorName:     window.currentUserData?.name || 'Anonymous',
      donorEmail:    window.currentUser.email,
      foodName:      foodName,
      category:      category,
      quantity:      parseFloat(quantity),
      unit:          unit || 'kg',
      expiryDate:    new Date(expiry),
      pickupStart:   pickupStart ? new Date(pickupStart) : null,
      pickupEnd:     pickupEnd   ? new Date(pickupEnd)   : null,
      location:      location,
      notes:         notes,
      status:        'available',
      createdAt:     serverTimestamp()
    });

    // Update global stats
    await updateGlobalStats(parseFloat(quantity));

    // Update user stats
    await updateUserStats(window.currentUser.uid, parseFloat(quantity));

    // Show success
    msgEl.style.color = 'var(--green)';
    msgEl.textContent = '✅ Food posted successfully! Thank you!';

    // Clear form
    clearDonorForm();

    // Reload my donations
    loadMyDonations();

    // Clear message after 3 seconds
    setTimeout(() => { msgEl.textContent = ''; }, 3000);

  } catch (error) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Error posting food. Please try again.';
    console.error('Post food error:', error);
  }
};

// ============================================
//  LOAD MY DONATIONS — Show donor's listings
// ============================================
window.loadMyDonations = function() {
  if (!window.currentUser) return;

  const listEl = document.getElementById('my-donations-list');
  if (!listEl) return;

  listEl.innerHTML = '<p class="empty-msg">⏳ Loading your donations...</p>';

  // Real-time listener for this donor's listings
  const q = query(
    collection(db, 'foodListings'),
    where('donorId', '==', window.currentUser.uid),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      listEl.innerHTML =
        '<p class="empty-msg">No donations yet. Post your first one! 👆</p>';
      return;
    }

    listEl.innerHTML = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id   = docSnap.id;
      listEl.appendChild(createDonationCard(data, id));
    });
  });
};

// ============================================
//  CREATE DONATION CARD — Build HTML card
// ============================================
function createDonationCard(data, id) {
  const div = document.createElement('div');
  div.className = 'donation-item';

  const expiry    = data.expiryDate?.toDate();
  const now       = new Date();
  const daysLeft  = expiry
    ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
    : null;

  const expiryText = daysLeft !== null
    ? (daysLeft < 0
        ? `<span class="expiry-soon">Expired!</span>`
        : daysLeft === 0
          ? `<span class="expiry-soon">Expires today!</span>`
          : daysLeft <= 2
            ? `<span class="expiry-soon">Expires in ${daysLeft} day(s)</span>`
            : `<span class="expiry-ok">Expires in ${daysLeft} days</span>`)
    : '';

  const categoryEmojis = {
    veg: '🥦', nonveg: '🍗', bakery: '🍞',
    dairy: '🥛', fruits: '🍎', cooked: '🍲', packaged: '📦'
  };

  div.innerHTML = `
    <button class="btn-delete" onclick="deleteDonation('${id}')">🗑️</button>
    <span class="category-badge">
      ${categoryEmojis[data.category] || '🍱'} ${data.category}
    </span>
    <h4>${data.foodName}</h4>
    <p>📦 ${data.quantity} ${data.unit}</p>
    <p>📍 ${data.location}</p>
    <p>${expiryText}</p>
    ${data.notes ? `<p>📝 ${data.notes}</p>` : ''}
    <span class="status-badge status-${data.status}">
      ${getStatusLabel(data.status)}
    </span>
  `;

  return div;
}

// ============================================
//  DELETE DONATION
// ============================================
window.deleteDonation = async function(id) {
  if (!confirm('Are you sure you want to delete this listing?')) return;

  try {
    await deleteDoc(doc(db, 'foodListings', id));
    console.log('✅ Donation deleted');
  } catch (error) {
    console.error('Delete error:', error);
    alert('Could not delete. Please try again.');
  }
};

// ============================================
//  UPDATE GLOBAL STATS
// ============================================
async function updateGlobalStats(kg) {
  const meals = Math.round(kg * 4);  // 1kg = ~4 meals
  const co2   = Math.round(kg * 2.5); // 1kg food = ~2.5kg CO2 saved

  try {
    await setDoc(doc(db, 'stats', 'global'), {
      totalKg:     increment(kg),
      totalMeals:  increment(meals),
      totalCo2:    increment(co2),
      totalDonors: increment(1)
    }, { merge: true });
  } catch (e) {
    console.log('Stats update error:', e);
  }
}

// ============================================
//  UPDATE USER STATS
// ============================================
async function updateUserStats(userId, kg) {
  const meals = Math.round(kg * 4);
  const co2   = Math.round(kg * 2.5);
  const water = Math.round(kg * 250); // 1kg food = ~250 litres water saved

  try {
    await setDoc(doc(db, 'userStats', userId), {
      totalKg:    increment(kg),
      totalMeals: increment(meals),
      totalCo2:   increment(co2),
      totalWater: increment(water),
      donations:  increment(1)
    }, { merge: true });
  } catch (e) {
    console.log('User stats error:', e);
  }
}

// ============================================
//  HELPER — Status label text
// ============================================
function getStatusLabel(status) {
  const labels = {
    available: '✅ Available',
    claimed:   '🤝 Claimed',
    pickedup:  '📦 Picked Up'
  };
  return labels[status] || status;
}

// ============================================
//  HELPER — Clear donor form
// ============================================
function clearDonorForm() {
  document.getElementById('food-name').value     = '';
  document.getElementById('food-category').value = '';
  document.getElementById('food-quantity').value = '';
  document.getElementById('food-unit').value     = '';
  document.getElementById('food-expiry').value   = '';
  document.getElementById('pickup-start').value  = '';
  document.getElementById('pickup-end').value    = '';
  document.getElementById('food-location').value = '';
  document.getElementById('food-notes').value    = '';
}

// ============================================
//  HELPER — Show login prompt inside a card
// ============================================
function showLoginPrompt(cardId, message) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.innerHTML = `
    <div class="login-prompt">
      <h3>🔐 Login Required</h3>
      <p>${message}</p>
      <button onclick="showPage('auth')" class="btn-primary">
        Login / Sign Up
      </button>
    </div>
  `;
}