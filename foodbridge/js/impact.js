// ============================================
//  FOODBRIDGE — impact.js
//  Impact page with rings, CO2, badges, share
// ============================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, collection,
  getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- Goals ----
const GOALS = { meals: 50, kg: 25, co2: 50, water: 500 };

// ---- All badges ----
const ALL_BADGES = [
  { id: 'first_donation', emoji: '🌱', name: 'First Step',    desc: 'Made your first donation',     req: 1,   stat: 'donations' },
  { id: 'five_donations', emoji: '🍱', name: 'Food Hero',     desc: '5 donations made',             req: 5,   stat: 'donations' },
  { id: 'ten_donations',  emoji: '🏆', name: 'Champion',      desc: '10 donations made',            req: 10,  stat: 'donations' },
  { id: 'kg_10',          emoji: '📦', name: 'Rescue Rookie', desc: 'Rescued 10kg of food',         req: 10,  stat: 'totalKg'   },
  { id: 'kg_50',          emoji: '🚀', name: 'Rescue Pro',    desc: 'Rescued 50kg of food',         req: 50,  stat: 'totalKg'   },
  { id: 'meals_10',       emoji: '🍽️', name: 'Feeder',        desc: 'Provided 10 meals',            req: 10,  stat: 'totalMeals'},
  { id: 'meals_50',       emoji: '❤️', name: 'Community Hero','desc': 'Provided 50 meals',          req: 50,  stat: 'totalMeals'},
  { id: 'co2_10',         emoji: '🌿', name: 'Eco Starter',   desc: 'Saved 10kg CO₂',              req: 10,  stat: 'totalCo2'  },
  { id: 'co2_50',         emoji: '🌍', name: 'Planet Saver',  desc: 'Saved 50kg CO₂',              req: 50,  stat: 'totalCo2'  },
];

// ---- Store stats globally for share modal ----
let myStats = { meals: 0, kg: 0, co2: 0, water: 0 };

// ============================================
//  LOAD IMPACT
// ============================================
window.loadImpact = async function() {
  if (!window.currentUser) {
    showGuestState();
    return;
  }

  try {
    const statsDoc = await getDoc(
      doc(db, 'userStats', window.currentUser.uid)
    );

    if (statsDoc.exists()) {
      const data = statsDoc.data();
      myStats = {
        meals: Math.round(data.totalMeals || 0),
        kg:    Math.round(data.totalKg    || 0),
        co2:   Math.round(data.totalCo2   || 0),
        water: Math.round(data.totalWater || 0),
      };
    }

    // Animate all elements
    setTimeout(() => {
      animateRings();
      animateProgressBars();
      updateCO2Visual();
      renderBadges(myStats);
    }, 300);

  } catch (e) {
    console.error('Impact load error:', e);
  }
};

// ============================================
//  ANIMATE RINGS
// ============================================
function animateRings() {
  const circumference = 283; // 2 * PI * 45

  // Counter animation
  animateImpactCounter('my-meals', myStats.meals);
  animateImpactCounter('my-kg',    myStats.kg);
  animateImpactCounter('my-co2',   myStats.co2);
  animateImpactCounter('my-water', myStats.water);

  // Ring fill animation
  animateRing('ring-meals', myStats.meals, GOALS.meals,  circumference);
  animateRing('ring-kg',    myStats.kg,    GOALS.kg,     circumference);
  animateRing('ring-co2',   myStats.co2,   GOALS.co2,    circumference);
  animateRing('ring-water', myStats.water, GOALS.water,  circumference);
}

function animateRing(id, value, goal, circumference) {
  const el = document.getElementById(id);
  if (!el) return;
  const pct    = Math.min(value / goal, 1);
  const offset = circumference - (pct * circumference);
  setTimeout(() => {
    el.style.strokeDashoffset = offset;
  }, 100);
}

// ============================================
//  ANIMATE PROGRESS BARS
// ============================================
function animateProgressBars() {
  setProgress('prog-meals', 'prog-meals-val',
    myStats.meals, GOALS.meals,  'meals');
  setProgress('prog-kg',    'prog-kg-val',
    myStats.kg,    GOALS.kg,     'kg');
  setProgress('prog-co2',   'prog-co2-val',
    myStats.co2,   GOALS.co2,    'kg CO₂');
  setProgress('prog-water', 'prog-water-val',
    myStats.water, GOALS.water,  'L');
}

function setProgress(barId, valId, value, goal, unit) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (!bar || !val) return;
  const pct = Math.min((value / goal) * 100, 100);
  setTimeout(() => { bar.style.width = pct + '%'; }, 200);
  val.textContent = `${value} / ${goal} ${unit}`;
}

// ============================================
//  CO2 VISUALIZATION
// ============================================
function updateCO2Visual() {
  const tree    = document.getElementById('impact-tree');
  const bar     = document.getElementById('co2-bar');
  const equiv   = document.getElementById('co2-equivalent');
  const target  = document.getElementById('co2-target-label');
  const co2     = myStats.co2;

  if (!tree) return;

  // Tree grows with CO2 saved
  if      (co2 >= 100) tree.textContent = '🌳';
  else if (co2 >= 50)  tree.textContent = '🌲';
  else if (co2 >= 20)  tree.textContent = '🌿';
  else if (co2 >= 5)   tree.textContent = '🪴';
  else                 tree.textContent = '🌱';

  // Bar fill
  const pct = Math.min((co2 / 100) * 100, 100);
  setTimeout(() => { if (bar) bar.style.width = pct + '%'; }, 300);

  if (target) target.textContent = `Goal: 100 kg`;

  // Equivalents
  if (equiv) {
    if      (co2 === 0)  equiv.textContent = '🌍 Start donating to see your carbon impact!';
    else if (co2 < 10)   equiv.textContent = `🚗 Equivalent to skipping ${co2} car trips!`;
    else if (co2 < 50)   equiv.textContent = `✈️ Like avoiding ${Math.round(co2/10)} short flights!`;
    else if (co2 < 100)  equiv.textContent = `🌳 You've saved the equivalent of planting ${Math.round(co2/5)} trees!`;
    else                 equiv.textContent = `🏆 Amazing! You've offset ${co2}kg of CO₂ — a real climate hero!`;
  }
}

// ============================================
//  RENDER BADGES
// ============================================
function renderBadges(stats) {
  const container = document.getElementById('badges-container');
  if (!container) return;

  container.innerHTML = '';

  ALL_BADGES.forEach(badge => {
    const statMap = {
      donations:  stats.donations || 0,
      totalKg:    stats.kg,
      totalMeals: stats.meals,
      totalCo2:   stats.co2,
    };

    const earned = (statMap[badge.stat] || 0) >= badge.req;
    const div    = document.createElement('div');
    div.className = `badge-card ${earned ? 'earned' : 'locked'}`;
    div.innerHTML = `
      <span class="badge-emoji">${badge.emoji}</span>
      <div class="badge-name">${badge.name}</div>
      <div class="badge-desc">${badge.desc}</div>
    `;
    container.appendChild(div);
  });
}

// ============================================
//  LOAD LEADERBOARD
// ============================================
window.loadLeaderboard = async function() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;

  listEl.innerHTML = '<p style="color:#6b7c6e;text-align:center;padding:20px">⏳ Loading...</p>';

  try {
    const snap = await getDocs(
      query(collection(db, 'userStats'),
        orderBy('totalKg', 'desc'), limit(10))
    );

    if (snap.empty) {
      listEl.innerHTML = '<p style="color:#6b7c6e;text-align:center;padding:20px">No data yet — be the first!</p>';
      return;
    }

    const items = [];
    const namePromises = snap.docs.map(async (d, i) => {
      const data = d.data();
      let name   = 'Anonymous';
      try {
        const userDoc = await getDoc(doc(db, 'users', d.id));
        if (userDoc.exists()) name = userDoc.data().name || 'Anonymous';
      } catch (e) {}
      items.push({
        rank:   i + 1,
        name,
        kg:     Math.round(data.totalKg    || 0),
        meals:  Math.round(data.totalMeals || 0),
        isMe:   d.id === window.currentUser?.uid
      });
    });

    await Promise.all(namePromises);
    listEl.innerHTML = '';

    items.forEach(item => {
      const div    = document.createElement('div');
      div.className = `lb-item ${item.isMe ? 'current-user' : ''}`;

      const rankDisplay = item.rank === 1 ? '🥇'
        : item.rank === 2 ? '🥈'
        : item.rank === 3 ? '🥉'
        : `<span class="lb-rank-num">${item.rank}</span>`;

      const colors = ['#2d6a4f','#0077b6','#e76f51','#7c3aed','#0d9488'];
      const color  = colors[(item.rank - 1) % colors.length];
      const initial = item.name[0].toUpperCase();

      div.innerHTML = `
        <div class="lb-rank">${rankDisplay}</div>
        <div class="lb-avatar" style="background:${color}">${initial}</div>
        <div class="lb-info">
          <div class="lb-name">${item.name}${item.isMe ? ' ⭐' : ''}</div>
          <div class="lb-stat">${item.meals} meals provided</div>
        </div>
        <div>
          <span class="lb-score">${item.kg}</span>
          <span class="lb-score-unit"> kg</span>
        </div>
      `;
      listEl.appendChild(div);
    });

  } catch (e) {
    listEl.innerHTML = '<p style="color:#e63946;text-align:center;padding:20px">Could not load leaderboard.</p>';
    console.error(e);
  }
};

// ============================================
//  SHARE MODAL
// ============================================
window.openShareModal = function() {
  document.getElementById('share-meals').textContent = myStats.meals;
  document.getElementById('share-kg').textContent    = myStats.kg;
  document.getElementById('share-co2').textContent   = myStats.co2;
  document.getElementById('share-water').textContent = myStats.water;
  document.getElementById('share-modal').classList.remove('hidden');
};

window.closeShareModal = function() {
  document.getElementById('share-modal').classList.add('hidden');
};

window.copyShareText = function() {
  const text = `🌱 My FoodBridge Impact:\n🍽️ ${myStats.meals} meals provided\n📦 ${myStats.kg}kg food rescued\n🌿 ${myStats.co2}kg CO₂ avoided\n💧 ${myStats.water}L water saved\n\nJoin me at FoodBridge!`;
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Copied to clipboard!');
  });
};

// ============================================
//  GUEST STATE
// ============================================
function showGuestState() {
  const body = document.querySelector('.impact-body');
  if (body) {
    body.innerHTML = `
      <div style="text-align:center;padding:80px 20px">
        <p style="font-size:4rem;margin-bottom:16px">🌱</p>
        <h2 style="font-family:'Playfair Display',serif;
          color:#1b2d1f;margin-bottom:12px">
          Start Your Impact Journey
        </h2>
        <p style="color:#6b7c6e;margin-bottom:28px">
          Login to see your personal impact stats
        </p>
        <button onclick="showPage('auth')"
          class="btn-primary"
          style="width:auto;padding:14px 32px">
          Login / Sign Up
        </button>
      </div>`;
  }
}

// ============================================
//  COUNTER ANIMATION
// ============================================
function animateImpactCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.ceil(target / 40) || 1;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current.toLocaleString();
  }, 30);
}