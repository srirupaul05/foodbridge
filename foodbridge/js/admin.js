// ============================================
//  FOODBRIDGE — admin.js
//  Admin dashboard — only for Srirup Paul
// ============================================

import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- Admin emails ----
const ADMIN_EMAILS = [
  'paulsrirup2005@gmail.com',
  'srirupaul14@gmail.com'
];

// ---- Store data for search ----
let allUsersData     = [];
let allDonationsData = [];
let allClaimsData    = [];

// ============================================
//  CHECK ADMIN ACCESS
// ============================================
window.loadAdmin = async function() {
  // Check if logged in
  if (!window.currentUser) {
    alert('❌ Access Denied! Please login first.');
    showPage('home');
    return;
  }

  // Check if admin
  if (!ADMIN_EMAILS.includes(window.currentUser.email)) {
    alert('❌ Access Denied! You are not an admin.');
    showPage('home');
    return;
  }

  // Show admin nav link
  const adminNav = document.getElementById('nav-admin');
  if (adminNav) adminNav.classList.remove('hidden');

  // Load all data
  await Promise.all([
    loadAdminOverview(),
    loadUsersTable(),
    loadDonationsTable(),
    loadClaimsTable()
  ]);
};

// ============================================
//  SHOW ADMIN NAV — when logged in as admin
// ============================================
window.showAdminNav = function() {
  if (!window.currentUser) return;
  if (ADMIN_EMAILS.includes(window.currentUser.email)) {
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) adminNav.classList.remove('hidden');
  }
};

// ============================================
//  LOAD OVERVIEW CARDS
// ============================================
async function loadAdminOverview() {
  try {
    // Total users
    const usersSnap = await getDocs(collection(db, 'users'));
    animateAdminCounter('admin-total-users', usersSnap.size);

    // Total donations
    const donationsSnap = await getDocs(
      collection(db, 'foodListings')
    );
    animateAdminCounter('admin-total-donations', donationsSnap.size);

    // Total claims
    const claimsSnap = await getDocs(collection(db, 'claims'));
    animateAdminCounter('admin-total-claims', claimsSnap.size);

    // Total kg from global stats
    const statsDoc = await getDoc(doc(db, 'stats', 'global'));
    if (statsDoc.exists()) {
      animateAdminCounter(
        'admin-total-kg',
        Math.round(statsDoc.data().totalKg || 0)
      );
    }

  } catch (e) {
    console.error('Overview error:', e);
  }
}

// ============================================
//  LOAD USERS TABLE
// ============================================
async function loadUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  try {
    const snapshot = await getDocs(
      query(collection(db, 'users'), orderBy('joinedAt', 'desc'))
    );

    allUsersData = [];
    snapshot.forEach(docSnap => {
      allUsersData.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderUsersTable(allUsersData);

  } catch (e) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="table-loading">
        ⚠️ Error loading users.
      </td></tr>`;
    console.error('Users table error:', e);
  }
}

// ---- Render Users Table ----
function renderUsersTable(data) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="table-loading">
        No users found.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(user => {
    const row = document.createElement('tr');
    const joinDate = user.joinedAt?.toDate
      ? formatAdminDate(user.joinedAt.toDate())
      : 'Unknown';

    row.innerHTML = `
      <td><strong>${user.name || 'N/A'}</strong></td>
      <td>${user.email || 'N/A'}</td>
      <td>
        <span class="badge-${user.role || 'donor'}">
          ${user.role || 'donor'}
        </span>
      </td>
      <td>${joinDate}</td>
      <td>${user.totalDonations || 0}</td>
      <td>
        <button
          class="btn-table-delete"
          onclick="adminDeleteUser('${user.id}')">
          🗑️ Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
//  LOAD DONATIONS TABLE
// ============================================
async function loadDonationsTable() {
  const tbody = document.getElementById('donations-tbody');
  if (!tbody) return;

  try {
    const snapshot = await getDocs(
      query(collection(db, 'foodListings'), orderBy('createdAt', 'desc'))
    );

    allDonationsData = [];
    snapshot.forEach(docSnap => {
      allDonationsData.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderDonationsTable(allDonationsData);

  } catch (e) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="table-loading">
        ⚠️ Error loading donations.
      </td></tr>`;
    console.error('Donations table error:', e);
  }
}

// ---- Render Donations Table ----
function renderDonationsTable(data) {
  const tbody = document.getElementById('donations-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="table-loading">
        No donations found.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(item => {
    const row      = document.createElement('tr');
    const posted   = item.createdAt?.toDate
      ? formatAdminDate(item.createdAt.toDate())
      : 'Unknown';
    const expiry   = item.expiryDate?.toDate
      ? formatAdminDate(item.expiryDate.toDate())
      : 'Unknown';
    const now      = new Date();
    const expired  = item.expiryDate?.toDate
      ? item.expiryDate.toDate() < now
      : false;

    const statusBadge = expired
      ? `<span class="badge-expired">Expired</span>`
      : item.status === 'claimed'
        ? `<span class="badge-claimed">Claimed</span>`
        : `<span class="badge-available">Available</span>`;

    row.innerHTML = `
      <td><strong>${item.foodName || 'N/A'}</strong></td>
      <td>${item.donorName || 'N/A'}</td>
      <td>${item.donorEmail || 'N/A'}</td>
      <td>${item.quantity} ${item.unit}</td>
      <td>${item.location || 'N/A'}</td>
      <td>${statusBadge}</td>
      <td>${posted}</td>
      <td>${expiry}</td>
      <td>
        <button
          class="btn-table-delete"
          onclick="adminDeleteListing('${item.id}')">
          🗑️ Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
//  LOAD CLAIMS TABLE
// ============================================
async function loadClaimsTable() {
  const tbody = document.getElementById('claims-tbody');
  if (!tbody) return;

  try {
    const snapshot = await getDocs(
      query(collection(db, 'claims'), orderBy('claimedAt', 'desc'))
    );

    allClaimsData = [];

    // Fetch listing details for each claim
    const promises = snapshot.docs.map(async (docSnap) => {
      const claim = { id: docSnap.id, ...docSnap.data() };

      // Get food name from listing
      try {
        const listingDoc = await getDoc(
          doc(db, 'foodListings', claim.listingId)
        );
        if (listingDoc.exists()) {
          claim.foodName = listingDoc.data().foodName;
          claim.location = listingDoc.data().location;
          claim.donorEmail = listingDoc.data().donorEmail;
        }
      } catch (e) {}

      // Get recipient email
      try {
        const recipientDoc = await getDoc(
          doc(db, 'users', claim.recipientId)
        );
        if (recipientDoc.exists()) {
          claim.recipientEmail = recipientDoc.data().email;
        }
      } catch (e) {}

      return claim;
    });

    allClaimsData = await Promise.all(promises);
    renderClaimsTable(allClaimsData);

  } catch (e) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="table-loading">
        ⚠️ Error loading claims.
      </td></tr>`;
    console.error('Claims table error:', e);
  }
}

// ---- Render Claims Table ----
function renderClaimsTable(data) {
  const tbody = document.getElementById('claims-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="table-loading">
        No claims yet.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(claim => {
    const row = document.createElement('tr');
    const claimedAt = claim.claimedAt?.toDate
      ? formatAdminDate(claim.claimedAt.toDate())
      : 'Unknown';

    row.innerHTML = `
      <td><strong>${claim.foodName || 'N/A'}</strong></td>
      <td>${claim.donorName || 'N/A'}</td>
      <td>${claim.donorEmail || 'N/A'}</td>
      <td>${claim.recipientName || 'N/A'}</td>
      <td>${claim.recipientEmail || 'N/A'}</td>
      <td>${claimedAt}</td>
      <td>
        <button
          class="btn-table-delete"
          onclick="adminDeleteClaim('${claim.id}')">
          🗑️ Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
//  SWITCH ADMIN TAB
// ============================================
window.switchAdminTab = function(tab) {
  // Hide all tabs
  document.querySelectorAll('.admin-table-container')
    .forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.admin-tab')
    .forEach(el => el.classList.remove('active'));

  // Show selected tab
  document.getElementById(`admin-tab-${tab}`)
    .classList.remove('hidden');
  event.target.classList.add('active');
};

// ============================================
//  SEARCH ADMIN TABLES
// ============================================
window.searchAdminTable = function(table) {
  const search = document.getElementById(`admin-search-${table}`)
    ?.value.toLowerCase().trim();

  if (table === 'users') {
    const filtered = allUsersData.filter(u =>
      u.name?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      u.role?.toLowerCase().includes(search)
    );
    renderUsersTable(filtered);
  }

  if (table === 'donations') {
    const filtered = allDonationsData.filter(d =>
      d.foodName?.toLowerCase().includes(search) ||
      d.donorName?.toLowerCase().includes(search) ||
      d.donorEmail?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search) ||
      d.status?.toLowerCase().includes(search)
    );
    renderDonationsTable(filtered);
  }

  if (table === 'claims') {
    const filtered = allClaimsData.filter(c =>
      c.foodName?.toLowerCase().includes(search) ||
      c.donorName?.toLowerCase().includes(search) ||
      c.recipientName?.toLowerCase().includes(search) ||
      c.donorEmail?.toLowerCase().includes(search) ||
      c.recipientEmail?.toLowerCase().includes(search)
    );
    renderClaimsTable(filtered);
  }
};

// ============================================
//  ADMIN DELETE FUNCTIONS
// ============================================
window.adminDeleteUser = async function(userId) {
  if (!confirm('Delete this user? This cannot be undone!')) return;
  try {
    await deleteDoc(doc(db, 'users', userId));
    await loadUsersTable();
    await loadAdminOverview();
    alert('✅ User deleted!');
  } catch (e) {
    alert('❌ Could not delete user.');
    console.error(e);
  }
};

window.adminDeleteListing = async function(listingId) {
  if (!confirm('Delete this listing? This cannot be undone!')) return;
  try {
    await deleteDoc(doc(db, 'foodListings', listingId));
    await loadDonationsTable();
    await loadAdminOverview();
    alert('✅ Listing deleted!');
  } catch (e) {
    alert('❌ Could not delete listing.');
    console.error(e);
  }
};

window.adminDeleteClaim = async function(claimId) {
  if (!confirm('Delete this claim? This cannot be undone!')) return;
  try {
    await deleteDoc(doc(db, 'claims', claimId));
    await loadClaimsTable();
    await loadAdminOverview();
    alert('✅ Claim deleted!');
  } catch (e) {
    alert('❌ Could not delete claim.');
    console.error(e);
  }
};

// ============================================
//  HELPERS
// ============================================
function formatAdminDate(date) {
  return date.toLocaleDateString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit'
  });
}

function animateAdminCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current  = 0;
  const step   = Math.ceil(target / 30);
  const timer  = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current.toLocaleString();
  }, 50);
}