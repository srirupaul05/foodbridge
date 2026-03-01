// ============================================
//  NOURISHH — profile.js
// ============================================

import { auth, db } from './firebase-config.js';
import {
  doc, getDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ---- Avatar colors ----
const COLORS = [
  '#2d6a4f','#0077b6','#e76f51',
  '#7c3aed','#0d9488','#db2777'
];

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ============================================
//  LOAD PROFILE
// ============================================
window.loadProfile = async function() {
  if (!window.currentUser) {
    showPage('auth');
    return;
  }

  try {
    const [userDoc, statsDoc] = await Promise.all([
      getDoc(doc(db, 'users', window.currentUser.uid)),
      getDoc(doc(db, 'userStats', window.currentUser.uid))
    ]);

    const user  = userDoc.data()  || {};
    const stats = statsDoc.data() || {};

    // Avatar
    const avatarEl = document.getElementById('profile-avatar');
    const name     = user.name || 'U';
    if (avatarEl) {
      avatarEl.textContent       = name[0].toUpperCase();
      avatarEl.style.background  = stringToColor(name);
    }

    // Hero info
    const heroName = document.getElementById('profile-hero-name');
    const heroEmail = document.getElementById('profile-hero-email');
    const heroBadge = document.getElementById('profile-role-badge');
    const heroJoined = document.getElementById('profile-joined');

    if (heroName)  heroName.textContent  = name;
    if (heroEmail) heroEmail.textContent = user.email || '';
    if (heroBadge) {
      const roleEmojis = {
        donor: '🍱', recipient: '🙏', volunteer: '🚗'
      };
      heroBadge.textContent =
        `${roleEmojis[user.role] || '🍱'} ${user.role || 'donor'}`;
    }
    if (heroJoined && user.joinedAt?.toDate) {
      heroJoined.textContent = `Joined ${user.joinedAt.toDate()
        .toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric'
        })}`;
    }

    // Stats
    const donations = document.getElementById('profile-donations');
    const kg        = document.getElementById('profile-kg');
    const meals     = document.getElementById('profile-meals');

    if (donations) animateProfileCounter('profile-donations',
      stats.donations  || 0);
    if (kg)        animateProfileCounter('profile-kg',
      Math.round(stats.totalKg    || 0));
    if (meals)     animateProfileCounter('profile-meals',
      Math.round(stats.totalMeals || 0));

    // Form fields
    const nameInput  = document.getElementById('profile-name-input');
    const emailInput = document.getElementById('profile-email-input');
    const roleInput  = document.getElementById('profile-role-input');

    if (nameInput)  nameInput.value  = user.name  || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleInput)  roleInput.value  = user.role  || 'donor';

  } catch (e) {
    console.error('Profile load error:', e);
  }
};

// ============================================
//  SAVE PROFILE
// ============================================
window.saveProfile = async function() {
  if (!window.currentUser) return;

  const name    = document.getElementById('profile-name-input')
    ?.value.trim();
  const role    = document.getElementById('profile-role-input')
    ?.value;
  const msgEl   = document.getElementById('profile-save-msg');

  if (!name) {
    if (msgEl) {
      msgEl.style.color   = '#e63946';
      msgEl.textContent   = '⚠️ Name cannot be empty!';
    }
    return;
  }

  if (msgEl) {
    msgEl.style.color   = '#2d6a4f';
    msgEl.textContent   = '⏳ Saving...';
  }

  try {
    await updateDoc(
      doc(db, 'users', window.currentUser.uid),
      { name, role }
    );

    // Update navbar display name
    const display = document.getElementById('userNameDisplay');
    if (display) display.textContent = `👋 ${name}`;

    // Update hero name
    const heroName = document.getElementById('profile-hero-name');
    if (heroName) heroName.textContent = name;

    // Update avatar
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      avatarEl.textContent      = name[0].toUpperCase();
      avatarEl.style.background = stringToColor(name);
    }

    // Update role badge
    const heroBadge = document.getElementById('profile-role-badge');
    if (heroBadge) {
      const roleEmojis = {
        donor: '🍱', recipient: '🙏', volunteer: '🚗'
      };
      heroBadge.textContent =
        `${roleEmojis[role] || '🍱'} ${role}`;
    }

    // Update global user data
    if (window.currentUserData) {
      window.currentUserData.name = name;
      window.currentUserData.role = role;
    }

    if (msgEl) {
      msgEl.style.color = '#2d6a4f';
      msgEl.textContent = '✅ Profile saved!';
      setTimeout(() => { msgEl.textContent = ''; }, 3000);
    }

  } catch (e) {
    if (msgEl) {
      msgEl.style.color = '#e63946';
      msgEl.textContent = '❌ Could not save. Try again.';
    }
    console.error(e);
  }
};

// ============================================
//  DELETE ACCOUNT
// ============================================
window.deleteAccount = async function() {
  if (!confirm(
    '⚠️ Are you sure? This will permanently delete your account and all your data!'
  )) return;

  if (!confirm(
    '🚨 Last warning — this CANNOT be undone. Delete account?'
  )) return;

  try {
    const uid = window.currentUser.uid;

    // Delete Firestore docs
    await deleteDoc(doc(db, 'users',     uid));
    await deleteDoc(doc(db, 'userStats', uid));

    // Delete Firebase Auth user
    await deleteUser(auth.currentUser);

    showToast('Account deleted. Sorry to see you go!', 'info');
    showPage('home');

  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      showToast('Please logout and login again first!', 'warning');
    } else {
      showToast('Could not delete account. Try again.', 'error');
    }
    console.error(e);
  }
};

// ============================================
//  COUNTER ANIMATION
// ============================================
function animateProfileCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.ceil(target / 30) || 1;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current.toLocaleString();
  }, 40);
}