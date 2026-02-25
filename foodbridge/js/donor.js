// ============================================
//  FOODBRIDGE — donor.js
//  Post food listings, camera & manage donations
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
  getDocs,
  setDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- Global photo variable ----
let capturedPhotoBase64 = null;
let cameraStream = null;

// ============================================
//  CAMERA — Start live camera
// ============================================
window.startCamera = async function() {
  const container  = document.getElementById('camera-container');
  const video      = document.getElementById('camera-feed');
  const btnStart   = document.getElementById('btn-start-camera');
  const btnCapture = document.getElementById('btn-capture');

  try {
    // Force LIVE camera only — no gallery
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // use back camera on phones
        width:      { ideal: 1280 },
        height:     { ideal: 720 }
      },
      audio: false
    });

    cameraStream     = stream;
    video.srcObject  = stream;
    container.classList.add('active');

    // Show capture button, hide start button
    btnStart.classList.add('hidden');
    btnCapture.classList.remove('hidden');

  } catch (error) {
    console.error('Camera error:', error);

    // Show helpful error message
    const cameraSection = document.getElementById('camera-section');
    const noCamera = document.createElement('p');
    noCamera.className = 'no-camera-msg';

    if (error.name === 'NotAllowedError') {
      noCamera.textContent =
        '❌ Camera permission denied. Please allow camera access and try again.';
    } else if (error.name === 'NotFoundError') {
      noCamera.textContent =
        '❌ No camera found on this device.';
    } else {
      noCamera.textContent =
        '❌ Could not access camera. Please try again.';
    }

    cameraSection.appendChild(noCamera);
  }
};

// ============================================
//  CAMERA — Capture photo
// ============================================
window.capturePhoto = function() {
  const video      = document.getElementById('camera-feed');
  const canvas     = document.getElementById('camera-canvas');
  const preview    = document.getElementById('photo-preview');
  const previewBox = document.getElementById('photo-preview-container');
  const container  = document.getElementById('camera-container');
  const btnCapture = document.getElementById('btn-capture');
  const btnRetake  = document.getElementById('btn-retake');

  // Draw video frame to canvas
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Compress photo to save Firestore space
  capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.5);

  // Show preview
  preview.src = capturedPhotoBase64;
  previewBox.classList.remove('hidden');

  // Hide camera feed
  container.classList.remove('active');

  // Stop camera stream
  stopCamera();

  // Show retake button
  btnCapture.classList.add('hidden');
  btnRetake.classList.remove('hidden');
};

// ============================================
//  CAMERA — Retake photo
// ============================================
window.retakePhoto = function() {
  const previewBox = document.getElementById('photo-preview-container');
  const btnRetake  = document.getElementById('btn-retake');
  const btnStart   = document.getElementById('btn-start-camera');

  // Clear captured photo
  capturedPhotoBase64 = null;

  // Hide preview
  previewBox.classList.add('hidden');

  // Show start camera button again
  btnRetake.classList.add('hidden');
  btnStart.classList.remove('hidden');
};

// ============================================
//  CAMERA — Stop stream
// ============================================
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

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

  // Check if photo was taken
  if (!capturedPhotoBase64) {
    const msgEl = document.getElementById('donor-msg');
    msgEl.style.color = '#e63946';
    msgEl.textContent =
      '⚠️ Please take a live photo of the food first!';
    document.getElementById('camera-section')
      .scrollIntoView({ behavior: 'smooth' });
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

  // ---- Date & Time Validation ----
  const now         = new Date();
  const expiryDate  = new Date(expiry);
  const startDate   = pickupStart ? new Date(pickupStart) : null;
  const endDate     = pickupEnd   ? new Date(pickupEnd)   : null;

  if (expiryDate <= now) {
    msgEl.style.color = '#e63946';
    msgEl.textContent =
      '⚠️ Expiry date cannot be in the past!';
    return;
  }
  if (startDate && endDate && startDate >= endDate) {
    msgEl.style.color = '#e63946';
    msgEl.textContent =
      '⚠️ Pickup start time must be before pickup end time!';
    return;
  }
  if (endDate && expiryDate && endDate > expiryDate) {
    msgEl.style.color = '#e63946';
    msgEl.textContent =
      '⚠️ Pickup end time cannot be after expiry date!';
    return;
  }
  if (startDate && expiryDate && startDate >= expiryDate) {
    msgEl.style.color = '#e63946';
    msgEl.textContent =
      '⚠️ Pickup start time must be before expiry date!';
    return;
  }

if (!location) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Please enter pickup location.';
    return;
  }

  // ---- Anti-abuse limits ----
  // Max 50kg per donation
  if (parseFloat(quantity) > 50) {
    msgEl.style.color = '#e63946';
    msgEl.textContent =
      '⚠️ Maximum 50kg per donation. Contact us for larger donations.';
    return;
  }

// Show loading
  msgEl.style.color = 'var(--green)';
  msgEl.textContent = '⏳ Posting your listing...';

  try {
    // ---- Check daily limit (max 3 donations per day) ----
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd  = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayQuery = query(
      collection(db, 'foodListings'),
      where('donorId',   '==', window.currentUser.uid),
      where('createdAt', '>=', today),
      where('createdAt', '<=', todayEnd)
    );

    const todayDocs = await getDocs(todayQuery);
    if (todayDocs.size >= 3) {
      msgEl.style.color = '#e63946';
      msgEl.textContent =
        '⚠️ Daily limit reached! Maximum 3 donations per day.';
      return;
    }

    // Add to Firestore with photo
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
      photo:         capturedPhotoBase64, // 📸 live photo stored
      status:        'available',
      createdAt:     serverTimestamp()
    });

 

    // Show success
    msgEl.style.color = 'var(--green)';
    msgEl.textContent = '✅ Food posted successfully! Thank you!';

    // Clear form and photo
    clearDonorForm();
    capturedPhotoBase64 = null;

    // Reload my donations
    loadMyDonations();

    setTimeout(() => { msgEl.textContent = ''; }, 3000);

  } catch (error) {
    msgEl.style.color = '#e63946';
    msgEl.textContent = '⚠️ Error posting food. Please try again.';
    console.error('Post food error:', error);
  }
};

// ============================================
//  LOAD MY DONATIONS
// ============================================
window.loadMyDonations = function() {
  if (!window.currentUser) return;

  const listEl = document.getElementById('my-donations-list');
  if (!listEl) return;

  listEl.innerHTML =
    '<p class="empty-msg">⏳ Loading your donations...</p>';

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
//  CREATE DONATION CARD
// ============================================
function createDonationCard(data, id) {
  const div = document.createElement('div');
  div.className = 'donation-item';

  const expiry   = data.expiryDate?.toDate();
  const now      = new Date();
  const daysLeft = expiry
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
    dairy: '🥛', fruits: '🍎', cooked: '🍲',
    packaged: '📦'
  };

  // Show photo if available
  const photoHTML = data.photo
    ? `<img src="${data.photo}"
            alt="Food photo"
            style="width:100%;
                   border-radius:10px;
                   margin-bottom:10px;
                   max-height:160px;
                   object-fit:cover"/>`
    : '';

  div.innerHTML = `
    <button class="btn-delete"
      onclick="deleteDonation('${id}')">🗑️</button>
    ${photoHTML}
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
    ${data.status === 'claimed' ? `
    <button
      class="btn-open-chat"
      onclick="openChat(
        '${id}',
        '${data.foodName}',
        '${data.claimedName || 'Recipient'}')">
      💬 Chat with Recipient
    </button>` : ''}
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
  } catch (error) {
    console.error('Delete error:', error);
    alert('Could not delete. Please try again.');
  }
};

// ============================================
//  UPDATE GLOBAL STATS
// ============================================
async function updateGlobalStats(kg) {
  const meals = Math.round(kg * 4);
  const co2   = Math.round(kg * 2.5);
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
  const water = Math.round(kg * 250);
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
//  HELPERS
// ============================================
function getStatusLabel(status) {
  const labels = {
    available: '✅ Available',
    claimed:   '🤝 Claimed',
    pickedup:  '📦 Picked Up'
  };
  return labels[status] || status;
}

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

  // Reset camera UI
  capturedPhotoBase64 = null;
  const previewBox = document.getElementById('photo-preview-container');
  const btnRetake  = document.getElementById('btn-retake');
  const btnStart   = document.getElementById('btn-start-camera');
  const btnCapture = document.getElementById('btn-capture');
  const container  = document.getElementById('camera-container');

  if (previewBox) previewBox.classList.add('hidden');
  if (btnRetake)  btnRetake.classList.add('hidden');
  if (btnCapture) btnCapture.classList.add('hidden');
  if (btnStart)   btnStart.classList.remove('hidden');
  if (container)  container.classList.remove('active');
}

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

// Stop camera when leaving donor page
window.addEventListener('hashchange', stopCamera);