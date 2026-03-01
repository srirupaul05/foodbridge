// ============================================
//  nourishh — app.js
//  Main logic: page routing & navigation
// ============================================

import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAILS = [
  'paulsrirup2005@gmail.com',
  'srirupaul14@gmail.com'
];

// ---- All page IDs ----
const pages = [
  'home', 'auth', 'donor',
  'recipient', 'tracker', 'impact'
];

// ---- Current logged in user (global) ----
window.currentUser = null;
window.currentUserData = null;

// ============================================
//  SHOW PAGE — switches between pages
// ============================================
  window.showPage = function(pageName) {
  // Hide all pages
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.classList.remove('active');
      el.classList.add('hidden');
    }
  });

  // Show selected page
  const activePage = document.getElementById(`page-${pageName}`);
  if (activePage) {
    
    activePage.classList.remove('hidden');
    activePage.classList.add('active');
  }
  // Update active nav link
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active-link');
    if (link.getAttribute('onclick')?.includes(pageName)) {
      link.classList.add('active-link');
    }
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Load page-specific data
  if (pageName === 'recipient') {
    if (typeof loadListings === 'function') loadListings();
  }
  if (pageName === 'donor' && window.currentUser) {
    if (typeof loadMyDonations === 'function') loadMyDonations();
  }
  if (pageName === 'impact') {
    if (typeof loadImpact === 'function') loadImpact();
    if (typeof loadLeaderboard === 'function') loadLeaderboard();
  }
  if (pageName === 'tracker' && window.currentUser) {
    if (typeof loadTrackerItems === 'function') loadTrackerItems();
  }
};

// ============================================
//  AUTH STATE LISTENER
//  Runs whenever user logs in or out
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is logged in
    window.currentUser = user;

    // Get user profile from Firestore
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        window.currentUserData = userDoc.data();
      }
    } catch (e) {
      console.log('Could not fetch user data:', e);
    }

    // Update navbar — show username, hide login/signup
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (navAuth) navAuth.classList.add('hidden');
    if (navUser) navUser.classList.remove('hidden');
    if (userNameDisplay) {
        // Wait for user data then show name
        const displayName = window.currentUserData?.name 
          || user.displayName 
          || user.email.split('@')[0];
        userNameDisplay.textContent = `👋 ${displayName}`;
      }

    // Load home stats
    loadHomeStats();

    // Reload current page data after login
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      const pageId = activePage.id.replace('page-', '');
      if (pageId === 'donor') loadMyDonations();
      if (pageId === 'recipient') loadListings();
      if (pageId === 'impact') { loadImpact(); loadLeaderboard(); }
      // Don't redirect if already on admin page
      if (pageId === 'admin') return;
    }

    // Show admin nav if admin
    if (typeof showAdminNav === 'function') {
      showAdminNav();
    }

    // Check email verification
    if (!user.emailVerified) {
      const banner = document.getElementById('verify-banner');
      if (banner) banner.classList.remove('hidden');
    } else {
      const banner = document.getElementById('verify-banner');
      if (banner) banner.classList.add('hidden');
    }

  } else {
    // User is logged out
    window.currentUser = null;
    window.currentUserData = null;

    // Update navbar — show login/signup
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');

    if (navAuth) navAuth.classList.remove('hidden');
    if (navUser) navUser.classList.add('hidden');

    // Load home stats (still visible when logged out)
    loadHomeStats();
  }
});

// ============================================
//  HOME FEATURED LISTINGS
// ============================================
async function loadHomeFeatured() {
  const grid = document.getElementById('home-featured-listings');
  if (!grid) return;

  try {
    const { collection, getDocs, query,
            where, orderBy, limit } = await import(
      "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    );

    const snap = await getDocs(
      query(
        collection(db, 'foodListings'),
        where('status', '==', 'available'),
        orderBy('createdAt', 'desc'),
        limit(3)
      )
    );

    if (snap.empty) {
      grid.innerHTML = `
        <div class="featured-empty">
          <p>🍱</p>
          <p>No listings yet — be the first to donate!</p>
        </div>`;
      return;
    }

    const categoryEmojis = {
      veg: '🥦', nonveg: '🍗', bakery: '🍞',
      dairy: '🥛', fruits: '🍎', cooked: '🍲',
      packaged: '📦'
    };

    grid.innerHTML = '';
    snap.forEach(d => {
      const item = d.data();
      const emoji = categoryEmojis[item.category] || '🍱';

      // Days left
      const now = new Date();
      const expiry = item.expiryDate?.toDate
        ? item.expiryDate.toDate() : null;
      const daysLeft = expiry
        ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
        : null;
      const expiryText = daysLeft === null ? ''
        : daysLeft <= 0 ? '⚠️ Expires today!'
        : daysLeft === 1 ? '🔴 1 day left'
        : `🟡 ${daysLeft} days left`;

      const card = document.createElement('div');
      card.className = 'featured-card';
      card.onclick = () => showPage('recipient');
      card.innerHTML = `
        <div class="featured-card-header">${emoji}</div>
        <div class="featured-card-body">
          <div class="featured-card-title">
            ${item.foodName || 'Food Item'}
          </div>
          <div class="featured-card-meta">
            <span>📍 ${item.location || 'Location N/A'}</span>
            <span>•</span>
            <span>${item.quantity || '?'} ${item.unit || ''}</span>
          </div>
          <span class="featured-card-tag">
            ${item.category || 'food'}
          </span>
          ${expiryText ? `
          <div class="featured-card-expiry">${expiryText}</div>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
    });

  } catch (e) {
    console.error('Featured listings error:', e);
  }
}

// ============================================
//  HOME STATS — animated counters
// ============================================
async function loadHomeStats() {
  try {
    const statsDoc = await getDoc(doc(db, 'stats', 'global'));
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      animateCounter('stat-meals', data.totalMeals || 0);
      animateCounter('stat-kg', data.totalKg || 0);
      animateCounter('stat-co2', data.totalCo2 || 0);
      animateCounter('stat-donors', data.totalDonors || 0);
    }
  } catch (e) {
    // If no stats yet, show zeros
    animateCounter('stat-meals', 0);
    animateCounter('stat-kg', 0);
    animateCounter('stat-co2', 0);
    animateCounter('stat-donors', 0);
  }
}

// ============================================
//  ANIMATE COUNTER — counts up to a number
// ============================================
window.animateCounter = function(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const duration = 1500;
  const steps = 60;
  const increment = target / steps;
  let current = 0;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    current = Math.min(Math.round(increment * step), target);
    el.textContent = current.toLocaleString();

    if (step >= steps) clearInterval(timer);
  }, duration / steps);
};

// ============================================
//  START — show home page on load
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.classList.remove('active');
      el.classList.add('hidden');
    }
  });
  showPage('home');
  loadHomeFeatured();
  console.log('🍃 Nourishh loaded!');
});

// ============================================
//  VERIFICATION HELPERS
// ============================================
window.resendBannerVerification = async function() {
  if (!auth.currentUser) return;
  try {
    await sendEmailVerification(auth.currentUser);
    alert('✅ Verification email sent! Check your inbox.');
  } catch (e) {
    alert('❌ Could not send email. Try again in a few minutes.');
  }
};

window.checkVerificationStatus = async function() {
  if (!auth.currentUser) return;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    const banner = document.getElementById('verify-banner');
    if (banner) banner.classList.add('hidden');
    alert('✅ Email verified! You now have full access.');
  } else {
    alert('❌ Email not verified yet. Please check your inbox!');
  }
};