// ============================================
//  FOODBRIDGE — app.js
//  Main logic: page routing & navigation
// ============================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- All page IDs ----
const pages = ['home', 'auth', 'donor', 'recipient', 'tracker', 'impact'];

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
    if (el) el.classList.remove('active');
  });

  // Show selected page
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.classList.add('active');

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
      userNameDisplay.textContent =
        `👋 ${window.currentUserData?.name || user.email}`;
    }

    // Load home stats
    loadHomeStats();

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
  showPage('home');
  console.log('🌱 FoodBridge loaded!');
});