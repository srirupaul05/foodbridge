// ============================================
//  FOODBRIDGE — admin.js
//  Clean & Modern Admin Dashboard
// ============================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc,
  deleteDoc, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- Admin emails ----
const ADMIN_EMAILS = [
  'paulsrirup2005@gmail.com',
  'srirupaul14@gmail.com'
];

// ---- Data stores ----
let allUsersData     = [];
let allDonationsData = [];
let allClaimsData    = [];

// ============================================
//  SHOW ADMIN NAV
// ============================================
window.showAdminNav = function() {
  if (!window.currentUser) return;
  if (ADMIN_EMAILS.includes(window.currentUser.email)) {
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) adminNav.classList.remove('hidden');
  }
};

// ============================================
//  LOAD ADMIN
// ============================================
window.loadAdmin = async function() {
  // Wait for auth
  if (!window.currentUser) {
    setTimeout(() => loadAdmin(), 300);
    return;
  }

  if (!ADMIN_EMAILS.includes(window.currentUser.email)) {
    showPage('home');
    return;
  }

  // Load overview by default
  showAdminSection('overview');
  await loadAdminOverview();
  await loadUsersTable();
  await loadDonationsTable();
  await loadClaimsTable();
};

// ============================================
//  SHOW ADMIN SECTION
// ============================================
window.showAdminSection = function(section) {
  // Hide all sections
  ['overview', 'users', 'donations', 'claims'].forEach(s => {
    const el = document.getElementById(`admin-section-${s}`);
    if (el) el.classList.add('hidden');
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.classList.remove('active');
  });

  // Show selected
  const target = document.getElementById(`admin-section-${section}`);
  if (target) target.classList.remove('hidden');
  const navBtn = document.getElementById(`nav-${section}`);
  if (navBtn) navBtn.classList.add('active');
};

// ============================================
//  OVERVIEW
// ============================================
async function loadAdminOverview() {
  try {
    const [usersSnap, donationsSnap, claimsSnap, statsDoc] =
      await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'foodListings')),
        getDocs(collection(db, 'claims')),
        getDoc(doc(db, 'stats', 'global'))
      ]);

    animateAdminCounter('admin-total-users',     usersSnap.size);
    animateAdminCounter('admin-total-donations', donationsSnap.size);
    animateAdminCounter('admin-total-claims',    claimsSnap.size);
    animateAdminCounter('admin-total-kg',
      Math.round(statsDoc.data()?.totalKg || 0));

  } catch (e) {
    console.error('Overview error:', e);
  }
}

// ============================================
//  USERS TABLE
// ============================================
async function loadUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'users'), orderBy('joinedAt', 'desc'))
    );

    allUsersData = [];
    snap.forEach(d => allUsersData.push({ id: d.id, ...d.data() }));

    const countEl = document.getElementById('users-count');
    if (countEl) countEl.textContent = `(${allUsersData.length})`;

    renderUsersTable(allUsersData);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-loading">⚠️ Error loading users.</td></tr>`;
  }
}

function renderUsersTable(data) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty"><p>No users found</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(user => {
    const row = document.createElement('tr');
    const joined = user.joinedAt?.toDate
      ? formatDate(user.joinedAt.toDate()) : '—';

    row.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;
            background:${stringToColor(user.name || 'U')};
            display:flex;align-items:center;justify-content:center;
            font-size:0.8rem;font-weight:700;color:white;flex-shrink:0">
            ${(user.name || 'U')[0].toUpperCase()}
          </div>
          <span style="font-weight:500;color:#111827">
            ${user.name || 'Unknown'}
          </span>
        </div>
      </td>
      <td style="color:#6b7280">${user.email || '—'}</td>
      <td><span class="role-badge ${user.role || 'donor'}">${user.role || 'donor'}</span></td>
      <td style="color:#6b7280">${joined}</td>
      <td style="color:#6b7280">${user.totalDonations || 0}</td>
      <td>
        <button class="btn-admin-delete" onclick="adminDeleteUser('${user.id}')">
          🗑 Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
//  DONATIONS TABLE
// ============================================
async function loadDonationsTable() {
  const tbody = document.getElementById('donations-tbody');
  if (!tbody) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'foodListings'), orderBy('createdAt', 'desc'))
    );

    allDonationsData = [];
    snap.forEach(d => allDonationsData.push({ id: d.id, ...d.data() }));

    const countEl = document.getElementById('donations-count');
    if (countEl) countEl.textContent = `(${allDonationsData.length})`;

    renderDonationsTable(allDonationsData);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-loading">⚠️ Error loading donations.</td></tr>`;
  }
}

function renderDonationsTable(data) {
  const tbody = document.getElementById('donations-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty"><p>No donations yet</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(item => {
    const row    = document.createElement('tr');
    const posted = item.createdAt?.toDate ? formatDate(item.createdAt.toDate()) : '—';
    const now    = new Date();
    const expired = item.expiryDate?.toDate
      ? item.expiryDate.toDate() < now : false;

    const status = expired ? 'expired'
      : item.status === 'claimed' ? 'claimed' : 'available';

    row.innerHTML = `
      <td style="font-weight:500;color:#111827">${item.foodName || '—'}</td>
      <td style="color:#6b7280">${item.donorName || '—'}</td>
      <td style="color:#6b7280">${item.quantity || '—'} ${item.unit || ''}</td>
      <td style="color:#6b7280">${item.location || '—'}</td>
      <td><span class="status-badge ${status}">${status}</span></td>
      <td style="color:#6b7280">${posted}</td>
      <td>
        <button class="btn-admin-delete" onclick="adminDeleteListing('${item.id}')">
          🗑 Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
//  CLAIMS TABLE
// ============================================
async function loadClaimsTable() {
  const tbody = document.getElementById('claims-tbody');
  if (!tbody) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'claims'), orderBy('claimedAt', 'desc'))
    );

    const promises = snap.docs.map(async d => {
      const claim = { id: d.id, ...d.data() };
      try {
        const listing = await getDoc(doc(db, 'foodListings', claim.listingId));
        if (listing.exists()) {
          claim.foodName   = listing.data().foodName;
          claim.donorName  = listing.data().donorName;
        }
      } catch (e) {}
      return claim;
    });

    allClaimsData = await Promise.all(promises);

    const countEl = document.getElementById('claims-count');
    if (countEl) countEl.textContent = `(${allClaimsData.length})`;

    renderClaimsTable(allClaimsData);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-loading">⚠️ Error loading claims.</td></tr>`;
  }
}

function renderClaimsTable(data) {
  const tbody = document.getElementById('claims-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="admin-empty"><p>No claims yet</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach(claim => {
    const row = document.createElement('tr');
    const claimedAt = claim.claimedAt?.toDate
      ? formatDate(claim.claimedAt.toDate()) : '—';

    row.innerHTML = `
      <td style="font-weight:500;color:#111827">${claim.foodName || '—'}</td>
      <td style="color:#6b7280">${claim.donorName || '—'}</td>
      <td style="color:#6b7280">${claim.recipientName || '—'}</td>
      <td style="color:#6b7280">${claimedAt}</td>
      <td>
        <button class="btn-admin-delete" onclick="adminDeleteClaim('${claim.id}')">
          🗑 Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
//  SEARCH
// ============================================
window.searchAdminTable = function(table) {
  const search = document.getElementById(`admin-search-${table}`)
    ?.value.toLowerCase().trim();

  if (table === 'users') {
    renderUsersTable(allUsersData.filter(u =>
      u.name?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      u.role?.toLowerCase().includes(search)
    ));
  }
  if (table === 'donations') {
    renderDonationsTable(allDonationsData.filter(d =>
      d.foodName?.toLowerCase().includes(search) ||
      d.donorName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search)
    ));
  }
  if (table === 'claims') {
    renderClaimsTable(allClaimsData.filter(c =>
      c.foodName?.toLowerCase().includes(search) ||
      c.donorName?.toLowerCase().includes(search) ||
      c.recipientName?.toLowerCase().includes(search)
    ));
  }
};

// ============================================
//  DELETE
// ============================================
window.adminDeleteUser = async function(id) {
  if (!confirm('Delete this user?')) return;
  try {
    await deleteDoc(doc(db, 'users', id));
    await loadUsersTable();
    await loadAdminOverview();
  } catch (e) { alert('Could not delete user.'); }
};

window.adminDeleteListing = async function(id) {
  if (!confirm('Delete this listing?')) return;
  try {
    await deleteDoc(doc(db, 'foodListings', id));
    await loadDonationsTable();
    await loadAdminOverview();
  } catch (e) { alert('Could not delete listing.'); }
};

window.adminDeleteClaim = async function(id) {
  if (!confirm('Delete this claim?')) return;
  try {
    await deleteDoc(doc(db, 'claims', id));
    await loadClaimsTable();
    await loadAdminOverview();
  } catch (e) { alert('Could not delete claim.'); }
};

// ============================================
//  HELPERS
// ============================================
function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function animateAdminCounter(id, target) {
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

function stringToColor(str) {
  const colors = [
    '#16a34a','#2563eb','#ea580c',
    '#7c3aed','#0d9488','#db2777'
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Legacy tab function (kept for compatibility)
window.switchAdminTab = window.showAdminSection;