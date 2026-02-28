// ============================================
//  FOODBRIDGE — impact.js
//  Impact dashboard, badges & leaderboard
// ============================================

import { auth, db } from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
//  ALL BADGES DEFINITION
// ============================================
const ALL_BADGES = [
  {
    id:        'first_donation',
    icon:      '🌱',
    name:      'First Step',
    desc:      'Make your first donation',
    condition: (stats) => stats.donations >= 1
  },
  {
    id:        'five_donations',
    icon:      '⭐',
    name:      'Rising Star',
    desc:      '5 donations made',
    condition: (stats) => stats.donations >= 5
  },
  {
    id:        'ten_donations',
    icon:      '🔥',
    name:      'On Fire',
    desc:      '10 donations made',
    condition: (stats) => stats.donations >= 10
  },
  {
    id:        'ten_kg',
    icon:      '♻️',
    name:      'Eco Warrior',
    desc:      'Rescued 10kg of food',
    condition: (stats) => stats.totalKg >= 10
  },
  {
    id:        'fifty_kg',
    icon:      '🏆',
    name:      'Food Hero',
    desc:      'Rescued 50kg of food',
    condition: (stats) => stats.totalKg >= 50
  },
  {
    id:        'hundred_meals',
    icon:      '🍽️',
    name:      'Hunger Fighter',
    desc:      'Provided 100 meals',
    condition: (stats) => stats.totalMeals >= 100
  },
  {
    id:        'five_hundred_meals',
    icon:      '👑',
    name:      'Community Champion',
    desc:      'Provided 500 meals',
    condition: (stats) => stats.totalMeals >= 500
  },
  {
    id:        'co2_saver',
    icon:      '🌿',
    name:      'Carbon Cutter',
    desc:      'Saved 25kg of CO₂',
    condition: (stats) => stats.totalCo2 >= 25
  },
  {
    id:        'water_saver',
    icon:      '💧',
    name:      'Water Guardian',
    desc:      'Saved 1000L of water',
    condition: (stats) => stats.totalWater >= 1000
  }
];

// ============================================
//  LOAD IMPACT — Personal impact stats
// ============================================
window.loadImpact = async function() {
  if (!window.currentUser) {
    showLoginPromptImpact();
    return;
  }

  try {
    const statsDoc = await getDoc(
      doc(db, 'userStats', window.currentUser.uid)
    );

    if (statsDoc.exists()) {
      const stats = statsDoc.data();

      // Animate each counter
      animateCounter('my-meals', stats.totalMeals  || 0);
      animateCounter('my-kg',    stats.totalKg     || 0);
      animateCounter('my-co2',   stats.totalCo2    || 0);
      animateCounter('my-water', stats.totalWater  || 0);

      // Load badges
      renderBadges(stats);

    } else {
      // New user with no stats yet
      animateCounter('my-meals', 0);
      animateCounter('my-kg',    0);
      animateCounter('my-co2',   0);
      animateCounter('my-water', 0);
      renderBadges({});
    }

    // Load city-wide stats
    loadCityStats();

  } catch (error) {
    console.error('Load impact error:', error);
  }
};

// ============================================
//  LOAD CITY STATS — Community wide numbers
// ============================================
async function loadCityStats() {
  try {
    const statsDoc = await getDoc(doc(db, 'stats', 'global'));

    if (statsDoc.exists()) {
      const data = statsDoc.data();

      // Check if city stats section exists
      const citySection = document.querySelector('.city-impact');
      if (!citySection) {
        addCityStatsSection(data);
      } else {
        document.getElementById('city-meals')
          && animateCounter('city-meals', data.totalMeals || 0);
        document.getElementById('city-kg')
          && animateCounter('city-kg',    data.totalKg    || 0);
        document.getElementById('city-co2')
          && animateCounter('city-co2',   data.totalCo2   || 0);
      }
    }
  } catch (e) {
    console.log('City stats error:', e);
  }
}

// ============================================
//  ADD CITY STATS SECTION — inject into page
// ============================================
function addCityStatsSection(data) {
  const container = document.querySelector('#page-impact .page-container');
  if (!container) return;

  const section = document.createElement('div');
  section.className = 'city-impact';
  section.innerHTML = `
    <h2>🌍 Community Impact</h2>
    <p>Together, FoodBridge users are making a real difference</p>
    <div class="city-stats">
      <div class="city-stat">
        <h3 id="city-meals">0</h3>
        <p>Total Meals</p>
      </div>
      <div class="city-stat">
        <h3 id="city-kg">0</h3>
        <p>KG Rescued</p>
      </div>
      <div class="city-stat">
        <h3 id="city-co2">0</h3>
        <p>KG CO₂ Saved</p>
      </div>
    </div>
  `;

  // Insert before badges card
  const badgesCard = document.querySelector('.badges-card');
  if (badgesCard) {
    container.insertBefore(section, badgesCard);
  } else {
    container.appendChild(section);
  }

  // Animate the new counters
  setTimeout(() => {
    animateCounter('city-meals', data.totalMeals || 0);
    animateCounter('city-kg',    data.totalKg    || 0);
    animateCounter('city-co2',   data.totalCo2   || 0);
  }, 100);
}

// ============================================
//  RENDER BADGES
// ============================================
function renderBadges(stats) {
  const container = document.getElementById('badges-container');
  if (!container) return;

  container.innerHTML = '';

  ALL_BADGES.forEach(badge => {
    const unlocked = badge.condition(stats);
    const div      = document.createElement('div');

    div.className = `badge-item ${unlocked ? '' : 'locked'}`;
    div.title     = badge.desc;
    div.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">${badge.name}</div>
      <div class="badge-locked-label">
        ${unlocked ? '✅ Unlocked' : '🔒 ' + badge.desc}
      </div>
    `;

    container.appendChild(div);
  });
}

// ============================================
//  LOAD LEADERBOARD — Top donors
// ============================================
window.loadLeaderboard = async function() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;

  listEl.innerHTML =
    '<p class="empty-msg">⏳ Loading leaderboard...</p>';

  try {
    const q = query(
      collection(db, 'userStats'),
      orderBy('totalMeals', 'desc'),
      limit(10)
    );

   const snapshot = await getDocs(
    query(collection(db, 'userStats'), orderBy('totalMeals', 'desc'), limit(10))
  );

  // Get user names from users collection
  const userNames = {};
  const usersSnap = await getDocs(collection(db, 'users'));
  usersSnap.forEach(d => {
    userNames[d.id] = d.data().name || 'Anonymous';
  });

    if (snapshot.empty) {
      listEl.innerHTML =
        '<p class="empty-msg">No entries yet. Be the first! 🌱</p>';
      return;
    }

    listEl.innerHTML = '';
    let rank = 1;

    // Get names for each user
      const promises = snapshot.docs.map(async (docSnap) => {
      const stats  = docSnap.data();
      const userId = docSnap.id;

      // Fetch user name
      let name = 'Anonymous';
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          name = userDoc.data().name || 'Anonymous';
        }
      } catch (e) {}

      return { stats, name, rank: rank++ };
    });

    const entries = await Promise.all(promises);

    entries.forEach(entry => {
      listEl.appendChild(
        createLeaderboardItem(entry.name, entry.stats, entry.rank)
      );
    });

  } catch (error) {
    listEl.innerHTML =
      '<p class="empty-msg">Could not load leaderboard.</p>';
    console.error('Leaderboard error:', error);
  }
};

// ============================================
//  CREATE LEADERBOARD ITEM
// ============================================
function createLeaderboardItem(name, stats, rank) {
  const div = document.createElement('div');
  div.className = 'leaderboard-item';

  const rankEmoji =
    rank === 1 ? '🥇' :
    rank === 2 ? '🥈' :
    rank === 3 ? '🥉' : rank;

  const rankClass =
    rank === 1 ? 'rank-1' :
    rank === 2 ? 'rank-2' :
    rank === 3 ? 'rank-3' : 'rank-other';

  // Highlight current user
  const isMe = window.currentUserData?.name === name;

  div.innerHTML = `
    <div class="rank-number ${rankClass}">${rankEmoji}</div>
    <div class="leaderboard-info">
      <h4>${name} ${isMe ? '⭐ (You)' : ''}</h4>
      <p>${stats.donations || 0} donations •
         ${stats.totalKg   || 0} kg rescued</p>
    </div>
    <div class="leaderboard-score">
      ${stats.totalMeals || 0}
      <span style="font-size:0.7rem;
                   color:var(--gray);
                   font-family:'DM Sans'"> meals</span>
    </div>
  `;

  return div;
}

// ============================================
//  SHOW LOGIN PROMPT on impact page
// ============================================
function showLoginPromptImpact() {
  const grid = document.querySelector('.impact-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="login-prompt" style="grid-column: 1/-1">
      <h3>🔐 Login to See Your Impact</h3>
      <p>Track your personal contribution to fighting food waste</p>
      <button onclick="showPage('auth')" class="btn-primary"
        style="width:auto; padding: 12px 32px; margin: 16px auto 0">
        Login / Sign Up
      </button>
    </div>
  `;
}