// routeHelpers.js — Utility functions for route coordinate processing

/**
 * Decode a Google/ORS encoded polyline string into [lat, lng] pairs.
 * Uses the standard polyline decode algorithm.
 */
export function decodePolyline(encoded) {
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

/**
 * Generate a reproducible segment ID from two coordinate pairs.
 * Rounds to 3 decimal places for consistent matching.
 */
export function generateSegmentId(lat1, lng1, lat2, lng2) {
  const r = (n) => Math.round(n * 1000) / 1000;
  return `seg_${r(lat1)}_${r(lng1)}_${r(lat2)}_${r(lng2)}`;
}

/**
 * Extract segment IDs from a geometry (array of [lat, lng] or {lat, lng}).
 * Uses sampling to ensure road segments are reasonably long and follow curves.
 */
export function extractSegmentsFromRoute(points, samplingRate = 5) {
  const segmentIds = [];
  const normalized = points.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : p);
  
  for (let i = 0; i < normalized.length - samplingRate; i += samplingRate) {
    const { lat: lat1, lng: lng1 } = normalized[i];
    const { lat: lat2, lng: lng2 } = normalized[i + samplingRate];
    segmentIds.push(generateSegmentId(lat1, lng1, lat2, lng2));
  }
  return segmentIds;
}
