// ============================================
//  FOODBRIDGE — map.js
//  Interactive map view of food listings
//  Uses Leaflet.js + OpenStreetMap (FREE!)
// ============================================

// ---- Global map state ----
let map          = null;
let mapMarkers   = [];
let currentView  = 'grid';

// ============================================
//  SWITCH VIEW — Grid or Map
// ============================================
window.switchView = function(view) {
  currentView = view;

  const gridEl   = document.getElementById('food-listings-grid');
  const mapEl    = document.getElementById('food-listings-map');
  const btnGrid  = document.getElementById('btn-grid-view');
  const btnMap   = document.getElementById('btn-map-view');

  if (view === 'map') {
    // Show map, hide grid
    gridEl.classList.add('hidden');
    mapEl.classList.remove('hidden');
    btnGrid.classList.remove('active');
    btnMap.classList.add('active');

    // Initialize map if first time
    initMap();

    // Plot all listings on map
    plotListingsOnMap(window.allListingsForMap || []);

  } else {
    // Show grid, hide map
    gridEl.classList.remove('hidden');
    mapEl.classList.add('hidden');
    btnGrid.classList.add('active');
    btnMap.classList.remove('active');
  }
};

// ============================================
//  INIT MAP — Create Leaflet map
// ============================================
function initMap() {
  // Only initialize once
  if (map) return;

  // Center on India by default
  map = L.map('leaflet-map').setView([22.5726, 88.3639], 12);

  // OpenStreetMap tiles — completely free!
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Try to get user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 13);

        // Add blue dot for user location
        L.circleMarker([lat, lng], {
          radius:      10,
          fillColor:   '#4285f4',
          color:       '#fff',
          weight:      3,
          fillOpacity: 1
        })
        .addTo(map)
        .bindPopup('📍 You are here!');
      },
      () => {
        console.log('Location access denied');
      }
    );
  }
}

// ============================================
//  PLOT LISTINGS ON MAP
// ============================================
async function plotListingsOnMap(listings) {
  if (!map) return;

  // Clear existing markers
  clearMarkers();

  // Show loading
  showMapLoading(true);

  const categoryEmojis = {
    veg:      '🥦',
    nonveg:   '🍗',
    bakery:   '🍞',
    dairy:    '🥛',
    fruits:   '🍎',
    cooked:   '🍲',
    packaged: '📦'
  };

  // Geocode and plot each listing
  for (const item of listings) {
    if (item.status !== 'available') continue;

    try {
      let lat, lng;

      // Use stored coordinates if available
      if (item.lat && item.lng) {
        lat = item.lat;
        lng = item.lng;
      } else {
        // Geocode address to coordinates
        const coords = await geocodeAddress(item.location);
        if (!coords) continue;
        lat = coords.lat;
        lng = coords.lng;
      }

      // Create custom emoji marker
      const emoji = categoryEmojis[item.category] || '🍱';
      const markerIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            background: #2d6a4f;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            width: 36px;
            height: 36px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            <div style="
              transform: rotate(45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              font-size: 1rem;
            ">${emoji}</div>
          </div>`,
        iconSize:   [36, 36],
        iconAnchor: [18, 36],
      });

      // Add marker to map
      const marker = L.marker([lat, lng], { icon: markerIcon })
        .addTo(map)
        .on('click', () => showMapPopup(item));

      mapMarkers.push(marker);

    } catch (e) {
      console.log('Could not plot:', item.foodName, e);
    }
  }

  showMapLoading(false);

  // Fit map to show all markers
  if (mapMarkers.length > 0) {
    const group = L.featureGroup(mapMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

// ============================================
//  GEOCODE ADDRESS — Convert to coordinates
//  Uses Nominatim (free, no API key needed!)
// ============================================
async function geocodeAddress(address) {
  try {
    // Add India to make search more accurate
    const searchQuery = encodeURIComponent(address + ', India');
    const url = `https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent':      'FoodBridge/1.0'
      }
    });

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;

  } catch (e) {
    console.log('Geocoding error:', e);
    return null;
  }
}

// ============================================
//  SHOW MAP POPUP — Food details on pin click
// ============================================
function showMapPopup(data) {
  const popup = document.getElementById('map-popup');
  if (!popup) return;

  const expiry   = data.expiryDate?.toDate();
  const now      = new Date();
  const daysLeft = expiry
    ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
    : null;

  const timeText = daysLeft !== null
    ? daysLeft <= 0
      ? '⚡ Expires today!'
      : `✅ ${daysLeft} days left`
    : '';

  const photoHTML = data.photo
    ? `<img src="${data.photo}" alt="Food photo"/>`
    : '';

  const isOwner    = window.currentUser?.uid === data.donorId;
  const isClaimed  = data.status === 'claimed';
  const claimedByMe = data.claimedBy === window.currentUser?.uid;

  popup.innerHTML = `
    <button class="map-popup-close" onclick="closeMapPopup()">✕</button>

    ${photoHTML}

    <h3>${data.foodName}</h3>

    <div class="map-popup-details">
      <p>📦 ${data.quantity} ${data.unit}</p>
      <p>📍 ${data.location}</p>
      <p>⏰ ${timeText}</p>
      <p>👤 ${data.donorName || 'Anonymous'}</p>
      ${data.notes ? `<p>📝 ${data.notes}</p>` : ''}
    </div>

    ${!isOwner && !isClaimed ? `
    <button
      class="btn-claim"
      onclick="claimFood('${data.id}', '${data.donorId}')"
      id="claim-btn-${data.id}">
      🤝 Claim This Food
    </button>` : ''}

    ${isClaimed && claimedByMe ? `
    <button
      class="btn-open-chat"
      onclick="openChat(
        '${data.id}',
        '${data.foodName}',
        '${data.donorName}')">
      💬 Chat with Donor
    </button>` : ''}

    ${isClaimed && !claimedByMe ? `
    <button class="btn-claim btn-claimed" disabled>
      Already Claimed
    </button>` : ''}
  `;

  popup.classList.remove('hidden');
}

// ============================================
//  CLOSE MAP POPUP
// ============================================
window.closeMapPopup = function() {
  const popup = document.getElementById('map-popup');
  if (popup) popup.classList.add('hidden');
};

// ============================================
//  SHOW MAP LOADING
// ============================================
function showMapLoading(show) {
  const mapEl = document.getElementById('food-listings-map');
  if (!mapEl) return;

  let loader = document.getElementById('map-loader');

  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id        = 'map-loader';
      loader.className = 'map-loading';
      loader.textContent = '📍 Finding food near you...';
      mapEl.appendChild(loader);
    }
  } else {
    if (loader) loader.remove();
  }
}

// ============================================
//  CLEAR ALL MARKERS
// ============================================
function clearMarkers() {
  mapMarkers.forEach(marker => {
    if (map) map.removeLayer(marker);
  });
  mapMarkers = [];
}

// ============================================
//  EXPOSE LISTINGS FOR MAP
//  Called from recipient.js when listings load
// ============================================
window.updateMapListings = function(listings) {
  window.allListingsForMap = listings;
  if (currentView === 'map') {
    plotListingsOnMap(listings);
  }
};