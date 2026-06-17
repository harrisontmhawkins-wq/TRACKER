mapboxgl.accessToken = window.MAPBOX_TOKEN;

const statusEl = document.getElementById("status");
const targetListEl = document.getElementById("target-list");

let map;
let userMarker;
let targets = [];

// Example static targets (you can replace with Life360 / API data later)
targets = [
  { id: "alpha", name: "Target Alpha", lat: 51.248, lng: -0.76 },
  { id: "beta", name: "Target Beta", lat: 51.26, lng: -0.78 }
];

function initMap(center) {
  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
    center,
    zoom: 13
  });

  map.on("load", () => {
    statusEl.textContent = "Map online. Tracking enabled.";

    // User marker
    userMarker = new mapboxgl.Marker({ color: "#00e5ff" })
      .setLngLat(center)
      .addTo(map);

    // Add targets
    targets.forEach(t => {
      new mapboxgl.Marker({ color: "#ff0066" })
        .setLngLat([t.lng, t.lat])
        .addTo(map);
    });

    renderTargetList(center);
  });
}

function renderTargetList(userCenter) {
  targetListEl.innerHTML = "";

  targets.forEach(t => {
    const distance = haversine(userCenter[1], userCenter[0], t.lat, t.lng);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="label">${t.name}</span><br/>
      Dist: ${distance.toFixed(2)} km
    `;
    li.onclick = () => {
      map.flyTo({ center: [t.lng, t.lat], zoom: 15, speed: 0.8 });
    };
    targetListEl.appendChild(li);
  });
}

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Ask for location
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    pos => {
      const center = [pos.coords.longitude, pos.coords.latitude];
      statusEl.textContent = "Location acquired. Initializing map...";
      initMap(center);

      // Watch position for live tracking
      navigator.geolocation.watchPosition(watchPos => {
        const lngLat = [watchPos.coords.longitude, watchPos.coords.latitude];
        if (userMarker) userMarker.setLngLat(lngLat);
        renderTargetList(lngLat);
      });
    },
    err => {
      console.error(err);
      statusEl.textContent = "Location denied. Using default view.";
      initMap([-0.76, 51.25]); // Aldershot-ish fallback
    }
  );
} else {
  statusEl.textContent = "Geolocation not supported on this device.";
}
