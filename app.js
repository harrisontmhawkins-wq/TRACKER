import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ====== GLOBALS ======
mapboxgl.accessToken = window.MAPBOX_TOKEN;

const statusEl = document.getElementById("status");
const targetListEl = document.getElementById("target-list");
const joinBtn = document.getElementById("join-bubble-btn");
const leaveBtn = document.getElementById("leave-bubble-btn");

let map;
let userMarker;
let friendMarkers = {};
let userId = null;
let userName = null;
let joined = false;
let watchId = null;

// ====== FIREBASE INIT ======
const app = initializeApp(window.FIREBASE_CONFIG);
const db = getDatabase(app);
const bubbleId = window.BUBBLE_ID;
const bubbleRef = ref(db, "bubbles/" + bubbleId);

// ====== MAP INIT ======
function initMap(center) {
  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
    center,
    zoom: 13
  });

  map.on("load", () => {
    statusEl.textContent = "MAP ONLINE: Ready to join bubble.";

    // User marker (pulsing)
    const el = document.createElement("div");
    el.className = "marker-pulse";
    userMarker = new mapboxgl.Marker(el).setLngLat(center).addTo(map);
  });
}

// ====== GEOLOCATION ======
function startGeolocation() {
  if (!("geolocation" in navigator)) {
    statusEl.textContent = "ERROR: Geolocation not supported on this device.";
    return;
  }

  statusEl.textContent = "REQUESTING LOCATION PERMISSION...";

  navigator.geolocation.getCurrentPosition(
    pos => {
      const center = [pos.coords.longitude, pos.coords.latitude];
      statusEl.textContent = "LOCATION ACQUIRED: Initializing map...";
      initMap(center);
    },
    err => {
      console.error(err);
      statusEl.textContent = "LOCATION DENIED: Using default view.";
      initMap([-0.76, 51.25]); // Aldershot-ish fallback
    }
  );
}

// ====== BUBBLE JOIN / LEAVE ======
function promptUserName() {
  let name = prompt("Enter a display name for the bubble:", "Harrison");
  if (!name) {
    name = "Anonymous";
  }
  return name;
}

function joinBubble() {
  if (joined) return;

  if (!map) {
    alert("Map not ready yet. Wait a second and try again.");
    return;
  }

  userName = promptUserName();
  userId = crypto.randomUUID();
  joined = true;

  statusEl.textContent = "JOINED BUBBLE: Broadcasting live position.";

  // Start watching position
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      pos => {
        const lngLat = [pos.coords.longitude, pos.coords.latitude];
        if (userMarker) userMarker.setLngLat(lngLat);

        // Push to Firebase
        set(ref(db, `bubbles/${bubbleId}/${userId}`), {
          name: userName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated: serverTimestamp()
        });
      },
      err => {
        console.error(err);
        statusEl.textContent = "ERROR: Unable to track position.";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000
      }
    );
  }

  // Listen for others
  listenToBubble();
}

function leaveBubble() {
  if (!joined) return;

  joined = false;
  statusEl.textContent = "LEFT BUBBLE: No longer broadcasting.";

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (userId) {
    remove(ref(db, `bubbles/${bubbleId}/${userId}`));
  }

  // Clear friend markers
  Object.values(friendMarkers).forEach(m => m.remove());
  friendMarkers = {};
  targetListEl.innerHTML = "";
}

// ====== LISTEN TO BUBBLE ======
function listenToBubble() {
  onValue(bubbleRef, snapshot => {
    const data = snapshot.val() || {};
    renderBubbleMembers(data);
    updateFriendMarkers(data);
  });
}

// ====== RENDER LIST ======
function renderBubbleMembers(members) {
  targetListEl.innerHTML = "";

  const entries = Object.entries(members);

  entries.forEach(([id, m]) => {
    const li = document.createElement("li");

    const isSelf = id === userId;
    const label = isSelf ? `${m.name} (YOU)` : m.name;

    li.innerHTML = `
      <span class="label">${label}</span><br/>
      <span class="meta">Lat: ${m.lat?.toFixed(4)} | Lng: ${m.lng?.toFixed(4)}</span>
    `;

    li.onclick = () => {
      if (m.lng && m.lat && map) {
        map.flyTo({ center: [m.lng, m.lat], zoom: 15, speed: 0.8 });
      }
    };

    targetListEl.appendChild(li);
  });

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="meta">No members in this bubble yet.</span>`;
    targetListEl.appendChild(li);
  }
}

// ====== FRIEND MARKERS ======
function updateFriendMarkers(members) {
  const ids = new Set(Object.keys(members));

  // Remove markers for users no longer in bubble
  Object.keys(friendMarkers).forEach(id => {
    if (!ids.has(id) || id === userId) {
      friendMarkers[id].remove();
      delete friendMarkers[id];
    }
  });

  // Add/update markers
  Object.entries(members).forEach(([id, m]) => {
    if (id === userId) return; // skip self

    if (!m.lat || !m.lng) return;

    if (!friendMarkers[id]) {
      const el = document.createElement("div");
      el.className = "marker-friend";
      friendMarkers[id] = new mapboxgl.Marker(el)
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    } else {
      friendMarkers[id].setLngLat([m.lng, m.lat]);
    }
  });
}

// ====== BUTTON EVENTS ======
joinBtn.addEventListener("click", () => {
  if (!joined) {
    joinBubble();
  }
});

leaveBtn.addEventListener("click", () => {
  if (joined) {
    leaveBubble();
  }
});

// ====== BOOT ======
startGeolocation();
