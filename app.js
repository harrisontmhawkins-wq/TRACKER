import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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

const app = initializeApp(window.FIREBASE_CONFIG);
const db = getDatabase(app);
const bubbleRef = ref(db, "bubbles/" + window.BUBBLE_ID);

function initMap(center) {
  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
    center,
    zoom: 13
  });

  map.on("load", () => {
    statusEl.textContent = "MAP ONLINE";

    const el = document.createElement("div");
    el.className = "marker-pulse";
    userMarker = new mapboxgl.Marker(el).setLngLat(center).addTo(map);
  });
}

function startGeolocation() {
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const center = [pos.coords.longitude, pos.coords.latitude];
      initMap(center);
    },
    () => {
      statusEl.textContent = "Location denied";
      initMap([-0.76, 51.25]);
    }
  );
}

function joinBubble() {
  if (joined) return;

  userName = prompt("Enter your name:", "Harrison") || "User";
  userId = crypto.randomUUID();
  joined = true;

  statusEl.textContent = "Joined bubble";

  watchId = navigator.geolocation.watchPosition(pos => {
    const lngLat = [pos.coords.longitude, pos.coords.latitude];
    userMarker.setLngLat(lngLat);

    set(ref(db, `bubbles/${window.BUBBLE_ID}/${userId}`), {
      name: userName,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      updated: serverTimestamp()
    });
  });

  onValue(bubbleRef, snapshot => {
    const data = snapshot.val() || {};
    updateList(data);
    updateMarkers(data);
  });
}

function leaveBubble() {
  if (!joined) return;

  joined = false;
  statusEl.textContent = "Left bubble";

  navigator.geolocation.clearWatch(watchId);
  remove(ref(db, `bubbles/${window.BUBBLE_ID}/${userId}`));

  Object.values(friendMarkers).forEach(m => m.remove());
  friendMarkers = {};
  targetListEl.innerHTML = "";
}

function updateList(members) {
  targetListEl.innerHTML = "";

  Object.entries(members).forEach(([id, m]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="label">${m.name}</span>`;
    li.onclick = () => map.flyTo({ center: [m.lng, m.lat], zoom: 15 });
    targetListEl.appendChild(li);
  });
}

function updateMarkers(members) {
  Object.entries(members).forEach(([id, m]) => {
    if (id === userId) return;

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

joinBtn.onclick = joinBubble;
leaveBtn.onclick = leaveBubble;

startGeolocation();
