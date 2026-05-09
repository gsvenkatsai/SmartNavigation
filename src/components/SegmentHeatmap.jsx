// SegmentHeatmap.jsx — Community score overlay as road-following polylines
// Fetches actual road geometry from ORS for each segment instead of straight lines.

import { useState, useEffect, useRef } from "react";
import { Polyline, Tooltip } from "react-leaflet";
import { useFirestoreCollection } from "../hooks/useFirestore";

// ─── Fallback coordinates for demo segments ───────────────────────────────
const DEMO_SEGMENTS = {
  seg_domlur_001: {
    startLat: 12.9602, startLng: 77.6342,
    endLat: 12.9618, endLng: 77.6401,
  },
  seg_koramangala_002: {
    startLat: 12.9252, startLng: 77.6237,
    endLat: 12.9279, endLng: 77.6271,
  },
  seg_hsr_003: {
    startLat: 12.9116, startLng: 77.6389,
    endLat: 12.9098, endLng: 77.6441,
  },
};

// ─── Geometry cache ───────────────────────────────────────────────────────
const geoCache = new Map();

function getSegmentColor(preferCount = 0, avoidCount = 0) {
  const score = preferCount - avoidCount;
  if (score > 10) return "#22c55e";
  if (score > -5) return "#eab308";
  return "#ef4444";
}

function getCoordsFromId(segmentId) {
  // Check demo fallback first
  if (DEMO_SEGMENTS[segmentId]) {
    const d = DEMO_SEGMENTS[segmentId];
    return { startLat: d.startLat, startLng: d.startLng, endLat: d.endLat, endLng: d.endLng };
  }
  // Try parsing from segment ID format: seg_lat1_lng1_lat2_lng2
  const parts = segmentId?.split("_");
  if (parts?.length === 5 && parts[0] === "seg") {
    return {
      startLat: parseFloat(parts[1]), startLng: parseFloat(parts[2]),
      endLat: parseFloat(parts[3]), endLng: parseFloat(parts[4]),
    };
  }
  return null;
}

/**
 * Fetch road-following geometry from OSRM directly.
 * Returns array of [lat, lng] pairs for Leaflet.
 */
async function fetchSegmentRoadGeometry(startLat, startLng, endLat, endLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OSRM heatmap fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords || coords.length === 0) {
    throw new Error("No coordinates in OSRM response");
  }

  // OSRM returns [lng, lat] → Convert to [lat, lng] for Leaflet
  return coords.map(([lng, lat]) => [lat, lng]);
}

export function SegmentHeatmap() {
  const { data: segments, loading } = useFirestoreCollection("segments");
  const [segmentGeometries, setSegmentGeometries] = useState({});
  const fetchingRef = useRef(false);
  // At top of SegmentHeatmap component
  useEffect(() => {
      geoCache.clear();
    }, []);
  useEffect(() => {
    if (!segments?.length) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    async function fetchAllGeometries() {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segId = seg.segment_id || seg.id;

        // Skip if already cached
        if (geoCache.has(segId)) {
          setSegmentGeometries(prev => ({ ...prev, [segId]: geoCache.get(segId) }));
          continue;
        }

        // Extract coordinates from segment data or fallback
        const rawCoords =
          seg.start_lat && seg.start_lng && seg.end_lat && seg.end_lng
            ? { startLat: seg.start_lat, startLng: seg.start_lng,
                endLat: seg.end_lat, endLng: seg.end_lng }
            : getCoordsFromId(segId);

        if (!rawCoords) continue;

        // Rate limit: 300ms delay between ORS calls
        if (i > 0) {
          await new Promise(r => setTimeout(r, 300));
        }

        try {
          const coords = await fetchSegmentRoadGeometry(
            rawCoords.startLat, rawCoords.startLng,
            rawCoords.endLat, rawCoords.endLng
          );
          geoCache.set(segId, coords);
          setSegmentGeometries(prev => ({ ...prev, [segId]: coords }));
        } catch (e) {
          console.warn(`[Heatmap] ORS failed for ${segId}, using straight line:`, e.message);
          // Fallback to straight line
          const fallback = [
            [rawCoords.startLat, rawCoords.startLng],
            [rawCoords.endLat, rawCoords.endLng],
          ];
          geoCache.set(segId, fallback);
          setSegmentGeometries(prev => ({ ...prev, [segId]: fallback }));
        }
      }
      fetchingRef.current = false;
    }

    fetchAllGeometries();
  }, [segments]);

  if (loading) return null;

  return (
    <>
      {segments.map((seg) => {
        const segId = seg.segment_id || seg.id;
        const coords = segmentGeometries[segId];

        if (!coords) return null;

        const preferCount = seg.prefer_count || 0;
        const avoidCount = seg.avoid_count || 0;
        const score = preferCount - avoidCount;
        const color = getSegmentColor(preferCount, avoidCount);
        
        // Pulse if recently updated (last 5 minutes)
        const lastUpdated = seg.last_updated?.toDate ? seg.last_updated.toDate() : new Date(seg.last_updated);
        const isRecent = (new Date() - lastUpdated) < 5 * 60 * 1000;

        return (
          <Polyline
            key={segId}
            positions={coords}
            pathOptions={{
              color,
              weight: 6,
              opacity: 0.75,
              lineCap: "round",
              lineJoin: "round",
              dashArray: score > 10 ? "1, 5" : null,
              className: isRecent ? "animate-pulse-segment" : undefined,
            }}
          >
            <Tooltip sticky>
              <div className="text-xs font-medium bg-gray-900 text-gray-100 p-1 rounded">
                <div className="font-bold mb-1 border-b border-gray-700 pb-1">
                  Segment: {segId}
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-green-400">✓ {preferCount} prefer</span>
                  <span className="text-red-400">✗ {avoidCount} avoid</span>
                </div>
                <div className={`mt-1 font-bold ${score >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Community Score: {score}
                </div>
                {seg.confidence && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    AI Confidence: {(seg.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}