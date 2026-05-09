/**
 * orsService.js — Full A-Z OpenRouteService Integration
 * All calls go through Vite dev proxy at /ors-api to avoid CORS.
 * Uses POST + Authorization header as ORS requires.
 */

const ORS_BASE = "/ors-api";
const getApiKey = () => import.meta.env.VITE_ORS_API_KEY;

// ─── Retry wrapper with exponential backoff ──────────────────────────────────
async function withRetry(fn, retries = 2, baseDelay = 800) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[ORS] Retry ${attempt + 1}/${retries} in ${delay}ms...`, err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * 1. Directions — POST to /geojson endpoint
 * Supports 2+ waypoints natively.
 */
export async function getDirections(waypoints) {
  return withRetry(async () => {
    const url = `${ORS_BASE}/v2/directions/driving-car/geojson`;
    const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getApiKey(),
        'Accept': 'application/json, application/geo+json'
      },
      body: JSON.stringify({ coordinates })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ORS Directions failed (${res.status}): ${text}`);
    }
    return await res.json();
  });
}

/**
 * 2. Isochrones — Reachability areas
 * range: time in seconds (e.g. 300 for 5 mins)
 */
export async function getIsochrones(lat, lng, range = 300) {
  return withRetry(async () => {
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
  });
}

/**
 * 3. Matrix — One-to-Many or Many-to-Many distances
 */
export async function getMatrix(locations) {
  return withRetry(async () => {
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
  });
}

/**
 * 4. Optimization — Solve TSP (Traveling Salesman)
 */
export async function optimizeRoute(jobs, vehicles) {
  return withRetry(async () => {
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
  });
}

/**
 * 5. POIs — Find nearby places
 */
export async function getNearbyPOIs(lat, lng, category = "fuel") {
  return withRetry(async () => {
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
  });
}

/**
 * 6. Snap — Snap coordinate to nearest road
 */
export async function snapToRoad(lat, lng) {
  return withRetry(async () => {
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
  });
}

/**
 * 7. Segment geometry — Used by DraggableRoute to fetch road-following path
 * between two points. Returns array of [lat, lng] pairs or null on failure.
 * Includes retry logic to reduce straight-line fallbacks.
 */
export async function fetchSegmentGeometry(startLat, startLng, endLat, endLng) {
  const url = `${ORS_BASE}/v2/directions/driving-car/geojson`;
  // Retry up to 3 times to minimize straight-line fallbacks
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getApiKey(),
          'Accept': 'application/json, application/geo+json'
        },
        body: JSON.stringify({
          coordinates: [[startLng, startLat], [endLng, endLat]]
        })
      });
      if (!res.ok) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        console.error(`[ORS] fetchSegmentGeometry failed: ${res.status}`);
        return null;
      }
      const data = await res.json();
      return data.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error("[ORS] fetchSegmentGeometry error:", err);
      return null;
    }
  }
  return null;
}