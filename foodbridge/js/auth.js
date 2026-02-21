// ============================================
//  FOODBRIDGE — auth.js
//  Login, Signup & Logout logic
// ============================================

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
//  SWITCH TAB — Login / Signup toggle
// ============================================
window.switchTab = function(tab) {
  const loginForm   = document.getElementById('login-form');
  const signupForm  = document.getElementById('signup-form');
  const tabs        = document.querySelectorAll('.auth-tab');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
  }

  // Clear error messages
  document.getElementById('login-error').textContent  = '';
  document.getElementById('signup-error').textContent = '';
};

// ============================================
//  SIGN UP — Create new account
// ============================================
window.signupUser = async function() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const role     = document.getElementById('signup-role').value;
  const errorEl  = document.getElementById('signup-error');

  // --- Validation ---
  if (!name) {
    errorEl.textContent = '⚠️ Please enter your full name.';
    return;
  }
  if (!email) {
    errorEl.textContent = '⚠️ Please enter your email.';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = '⚠️ Password must be at least 6 characters.';
    return;
  }
  if (!role) {
    errorEl.textContent = '⚠️ Please select your role.';
    return;
  }

  // --- Show loading ---
  errorEl.textContent = '⏳ Creating your account...';
  errorEl.style.color = 'var(--green)';

  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth, email, password
    );
    const user = userCredential.user;

    // Save user profile in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name:         name,
      email:        email,
      role:         role,
      impactScore:  0,
      totalKg:      0,
      totalMeals:   0,
      badges:       [],
      joinedAt:     serverTimestamp()
    });

    // Also initialize their stats
    await setDoc(doc(db, 'userStats', user.uid), {
      totalKg:    0,
      totalMeals: 0,
      totalCo2:   0,
      totalWater: 0,
      donations:  0
    });

    errorEl.textContent = '';

    // Redirect based on role
    if (role === 'donor') {
      showPage('donor');
    } else if (role === 'recipient') {
      showPage('recipient');
    } else {
      showPage('home');
    }

  } catch (error) {
    errorEl.style.color = '#e63946';
    errorEl.textContent = getFriendlyError(error.code);
  }
};

// ============================================
//  LOGIN — Sign in existing user
// ============================================
window.loginUser = async function() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');

  // --- Validation ---
  if (!email) {
    errorEl.textContent = '⚠️ Please enter your email.';
    return;
  }
  if (!password) {
    errorEl.textContent = '⚠️ Please enter your password.';
    return;
  }

  // --- Show loading ---
  errorEl.textContent = '⏳ Logging in...';
  errorEl.style.color = 'var(--green)';

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth, email, password
    );
    const user = userCredential.user;

    // Get user role from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();

    errorEl.textContent = '';

    // Redirect based on role
    if (userData?.role === 'donor') {
      showPage('donor');
    } else if (userData?.role === 'recipient') {
      showPage('recipient');
    } else {
      showPage('home');
    }

  } catch (error) {
    errorEl.style.color = '#e63946';
    errorEl.textContent = getFriendlyError(error.code);
  }
};

// ============================================
//  LOGOUT
// ============================================
window.logoutUser = async function() {
  try {
    await signOut(auth);
    showPage('home');
    console.log('✅ Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// ============================================
//  FRIENDLY ERROR MESSAGES
//  Converts Firebase error codes to readable text
// ============================================
function getFriendlyError(code) {
  const errors = {
    'auth/email-already-in-use':    '⚠️ This email is already registered. Try logging in.',
    'auth/invalid-email':           '⚠️ Please enter a valid email address.',
    'auth/weak-password':           '⚠️ Password is too weak. Use at least 6 characters.',
    'auth/user-not-found':          '⚠️ No account found with this email.',
    'auth/wrong-password':          '⚠️ Incorrect password. Please try again.',
    'auth/too-many-requests':       '⚠️ Too many attempts. Please wait a moment.',
    'auth/network-request-failed':  '⚠️ Network error. Check your internet connection.',
    'auth/invalid-credential':      '⚠️ Invalid email or password. Please try again.',
  };
  return errors[code] || '⚠️ Something went wrong. Please try again.';
}