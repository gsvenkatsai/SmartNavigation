/**
 * orsService.js — Full A-Z OpenRouteService Integration
 * Wraps Directions, Isochrones, Matrix, Optimization, and POIs
 */

const ORS_BASE = "https://api.openrouteservice.org";
const getApiKey = () => import.meta.env.VITE_ORS_API_KEY;

/**
 * 1. Directions (Already used in DraggableRoute, but centralized here for logic)
 */
export async function getDirections(waypoints) {
  const url = `${ORS_BASE}/v2/directions/driving-car/geojson`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getApiKey()
    },
    body: JSON.stringify({ coordinates: waypoints.map(w => [w.lng, w.lat]) })
  });
  if (!res.ok) throw new Error("ORS Directions failed");
  return await res.json();
}

/**
 * 2. Isochrones — Reachability areas
 * range: time in seconds (e.g. 300 for 5 mins)
 */
export async function getIsochrones(lat, lng, range = 300) {
  const url = `${ORS_BASE}/v2/isochrones/driving-car`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getApiKey()
    },
    body: JSON.stringify({
      locations: [[lng, lat]],
      range: [range],
      attributes: ['area', 'reachfactor']
    })
  });
  if (!res.ok) throw new Error("ORS Isochrones failed");
  return await res.json();
}

/**
 * 3. Matrix — One-to-Many or Many-to-Many distances
 */
export async function getMatrix(locations) {
  const url = `${ORS_BASE}/v2/matrix/driving-car`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getApiKey()
    },
    body: JSON.stringify({
      locations: locations.map(l => [l.lng, l.lat]),
      metrics: ['duration', 'distance']
    })
  });
  if (!res.ok) throw new Error("ORS Matrix failed");
  return await res.json();
}

/**
 * 4. Optimization — Solve TSP (Traveling Salesman)
 */
export async function optimizeRoute(jobs, vehicles) {
  const url = `${ORS_BASE}/optimization`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getApiKey()
    },
    body: JSON.stringify({ jobs, vehicles })
  });
  if (!res.ok) throw new Error("ORS Optimization failed");
  return await res.json();
}

/**
 * 5. POIs — Find nearby places
 */
export async function getNearbyPOIs(lat, lng, category = "fuel") {
  const url = `${ORS_BASE}/pois`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getApiKey()
    },
    body: JSON.stringify({
      request: "pois",
      geometry: {
        geojson: { type: "Point", coordinates: [lng, lat] },
        buffer: 1000 // 1km
      },
      filters: {
        category_group_ids: [160] // Gas stations by default
      }
    })
  });
  if (!res.ok) throw new Error("ORS POIs failed");
  return await res.json();
}

/**
 * 6. Snap — Snap coordinate to nearest road
 */
export async function snapToRoad(lat, lng) {
  // We can use the directions API with single point to snap, 
  // but ORS also has a specific snap endpoint in some versions.
  // Using directions for robustness.
  const url = `${ORS_BASE}/v2/directions/driving-car/geojson`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getApiKey()
    },
    body: JSON.stringify({ coordinates: [[lng, lat], [lng, lat]] })
  });
  const data = await res.json();
  const snapped = data.features[0].geometry.coordinates[0];
  return { lat: snapped[1], lng: snapped[0] };
}
