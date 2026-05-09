// DraggableRoute.jsx — ORS-style Multi-Waypoint Routing
// Tap/click route to add waypoint, drag to move, long-press/right-click to remove.
// Fully touch-responsive for mobile.

import { useEffect, useState, useRef, useCallback } from "react";
import { Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { extractSegmentsFromRoute } from "../utils/routeHelpers";
import { fetchSegmentGeometry } from "../services/orsService";
import { useFirestoreDoc } from "../hooks/useFirestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

// ─── Icons ────────────────────────────────────────────────────────────────────

const createEndpointIcon = (color, label) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      background:${color};border:3px solid white;
      transform:rotate(-45deg);box-shadow:0 3px 12px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:white;font-size:12px;font-weight:bold;">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

const startIcon = createEndpointIcon("#22c55e", "S");
const endIcon   = createEndpointIcon("#ef4444", "D");

// ORS-style numbered waypoint marker
const createNumberedIcon = (num) =>
  L.divIcon({
    className: "numbered-waypoint",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:linear-gradient(135deg, #f59e0b, #d97706);
      border:3px solid white;
      box-shadow:0 2px 10px rgba(245,158,11,0.5);
      display:flex;align-items:center;justify-content:center;
      cursor:grab;font-size:12px;font-weight:bold;color:white;
      user-select:none;
      -webkit-user-select:none;
      touch-action:none;">
      ${num}
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

// ─── Segment geometry cache ───────────────────────────────────────────────────
const segmentCache = new Map();

function segmentKey(a, b) {
  return `${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
}

async function fetchSegment(from, to) {
  const key = segmentKey(from, to);
  if (segmentCache.has(key)) return segmentCache.get(key);
  const coords = await fetchSegmentGeometry(from.lat, from.lng, to.lat, to.lng);
  if (!coords) {
    // Don't cache failures — return straight line but allow retry next time
    console.warn("[DraggableRoute] ORS fetch failed, straight line fallback");
    return [[from.lat, from.lng], [to.lat, to.lng]];
  }
  segmentCache.set(key, coords);
  return coords;
}

// ─── Build full geometry from waypoints ──────────────────────────────────────
async function buildRouteFromWaypoints(allWaypoints) {
  // Fetch all segments in parallel
  const segmentGeoms = await Promise.all(
    allWaypoints.slice(0, -1).map((wp, i) =>
      fetchSegment(wp, allWaypoints[i + 1])
    )
  );
  const fullGeometry = segmentGeoms.reduce((acc, seg, i) => {
    return acc.concat(i === 0 ? seg : seg.slice(1));
  }, []);
  return { segments: segmentGeoms, fullGeometry };
}

function haversineDistance(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat/2) ** 2 +
    Math.cos(a[0] * Math.PI/180) * Math.cos(b[0] * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function geometryDistance(coords) {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) d += haversineDistance(coords[i], coords[i+1]);
  return d;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraggableRoute({
  source,
  destination,
  sessionId,
  isHost = true,
  onRouteReady,
  onRouteUpdated,
  onSegmentDragged,
}) {
  const map = useMap();

  const [pinnedWaypoints, setPinnedWaypoints] = useState([]);
  const [segmentGeoms, setSegmentGeoms] = useState([]);
  const [fullGeometry, setFullGeometry] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const lastWpStringRef = useRef("");
  const buildAbortRef = useRef(0);
  const longPressTimerRef = useRef(null);

  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);

  // ── Disable double-click zoom to prevent conflicts ─────────────────────────
  useEffect(() => {
    if (map) {
      map.doubleClickZoom.disable();
      return () => map.doubleClickZoom.enable();
    }
  }, [map]);

  // ── Sync from Firestore (Guest view) ───────────────────────────────────────
  useEffect(() => {
    if (!isHost && sessionData) {
      if (sessionData.pinned_waypoints) {
        try {
          setPinnedWaypoints(JSON.parse(sessionData.pinned_waypoints));
        } catch {}
      }
      // Render pre-computed route geometry instantly for guests
      if (sessionData.route_geometry) {
        try {
          const geo = JSON.parse(sessionData.route_geometry);
          if (geo && geo.length > 2) {
            setFullGeometry(geo);
            setSegmentGeoms([geo]);
          }
        } catch {}
      }
    }
  }, [isHost, sessionData?.pinned_waypoints, sessionData?.route_geometry]);

  // ── All waypoints: source + pins + destination ─────────────────────────────
  const allWaypoints = source && destination
    ? [{ lat: source.lat, lng: source.lng }, ...pinnedWaypoints, { lat: destination.lat, lng: destination.lng }]
    : [];

  // ── Rebuild route when waypoints change ────────────────────────────────────
  useEffect(() => {
    if (!source || !destination) return;
    const wpString = JSON.stringify(allWaypoints);
    if (wpString === lastWpStringRef.current) return;
    lastWpStringRef.current = wpString;

    const buildId = ++buildAbortRef.current;
    setIsLoading(true);
    setFetchError(null);

    buildRouteFromWaypoints(allWaypoints)
      .then(({ segments, fullGeometry: fg }) => {
        if (buildId !== buildAbortRef.current) return;
        setSegmentGeoms(segments);
        setFullGeometry(fg);
        const totalKm = geometryDistance(fg);
        const totalTime = Math.round((totalKm / 30) * 60);
        onRouteReady?.({
          totalDistance: totalKm.toFixed(1),
          totalTime,
        });
        onRouteUpdated?.(allWaypoints);
        onSegmentDragged?.(extractSegmentsFromRoute(fg, 10));
        if (fg.length > 0) map.fitBounds(fg, { padding: [50, 50], animate: true, maxZoom: 16 });
        // Sync to Firestore for live guest updates
        if (isHost && sessionId) {
          updateDoc(doc(db, "sessions", sessionId), {
            route_geometry: JSON.stringify(fg),
            pinned_waypoints: JSON.stringify(pinnedWaypoints),
          }).catch(console.error);
        }
      })
      .catch((err) => {
        if (buildId !== buildAbortRef.current) return;
        console.error("[DraggableRoute] Route build failed:", err);
        setFetchError("Route calculation failed. Try again.");
      })
      .finally(() => {
        if (buildId === buildAbortRef.current) setIsLoading(false);
      });
  }, [source, destination, pinnedWaypoints]);

  // ── Click/tap on polyline to add waypoint ──────────────────────────────────
  const handlePolylineClick = useCallback((e, segIdx) => {
    if (!isHost) return;
    L.DomEvent.stopPropagation(e);
    const newPin = { lat: e.latlng.lat, lng: e.latlng.lng };
    setPinnedWaypoints((prev) => {
      const updated = [...prev];
      updated.splice(segIdx, 0, newPin);
      return updated;
    });
  }, [isHost]);

  // ── Drag waypoint to new position ──────────────────────────────────────────
  const handleWaypointDragEnd = useCallback((e, idx) => {
    map.dragging.enable();
    const pos = e.target.getLatLng();
    setPinnedWaypoints((prev) => {
      const updated = [...prev];
      updated[idx] = { lat: pos.lat, lng: pos.lng };
      return updated;
    });
  }, [map]);

  // ── Remove waypoint ───────────────────────────────────────────────────────
  const handleWaypointRemove = useCallback((idx) => {
    setPinnedWaypoints((prev) => prev.filter((_, j) => j !== idx));
  }, []);

  // ── Long press detection for mobile (remove waypoint) ──────────────────────
  const startLongPress = useCallback((idx) => {
    longPressTimerRef.current = setTimeout(() => {
      if (window.confirm(`Remove waypoint ${idx + 1}?`)) {
        handleWaypointRemove(idx);
      }
    }, 600);
  }, [handleWaypointRemove]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  if (!source || !destination) return null;

  const segColors = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

  return (
    <>
      {fetchError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/90 backdrop-blur text-white px-4 py-2 rounded-lg border border-red-500/50 text-xs shadow-xl max-w-[90%]">
          {fetchError}
        </div>
      )}

      {isLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 backdrop-blur text-indigo-300 px-4 py-2 rounded-lg border border-indigo-500/30 text-xs shadow-xl flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Calculating route...
        </div>
      )}

      {/* Route outline shadow for visibility */}
      {fullGeometry.length > 0 && (
        <Polyline
          positions={fullGeometry}
          pathOptions={{ color: "#1e1b4b", weight: 10, opacity: 0.4, lineJoin: "round", lineCap: "round" }}
        />
      )}

      {/* Colored segment polylines */}
      {segmentGeoms.map((segCoords, i) => {
        const color = segColors[i % segColors.length];
        return (
          <Polyline
            key={`seg-${i}-${segCoords.length}`}
            positions={segCoords}
            pathOptions={{
              color,
              weight: 6,
              opacity: 0.9,
              lineJoin: "round",
              lineCap: "round",
            }}
            eventHandlers={{
              click: (e) => handlePolylineClick(e, i),
              mouseover: (e) => {
                if (isHost) e.target.setStyle({ weight: 10, opacity: 1 });
              },
              mouseout: (e) => {
                if (isHost) e.target.setStyle({ weight: 6, opacity: 0.9 });
              },
            }}
          >
            {isHost && (
              <Tooltip sticky direction="top" opacity={0.95}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color }}>
                  Tap to add waypoint
                </span>
              </Tooltip>
            )}
          </Polyline>
        );
      })}

      {/* ORS-style numbered waypoint markers — Host (draggable) */}
      {isHost && pinnedWaypoints.map((wp, i) => (
        <Marker
          key={`pin-${i}-${wp.lat}-${wp.lng}`}
          position={[wp.lat, wp.lng]}
          icon={createNumberedIcon(i + 1)}
          draggable={true}
          eventHandlers={{
            dragstart: () => {
              cancelLongPress();
              map.dragging.disable();
            },
            dragend: (e) => handleWaypointDragEnd(e, i),
            contextmenu: (e) => {
              L.DomEvent.preventDefault(e);
              L.DomEvent.stopPropagation(e);
              handleWaypointRemove(i);
            },
            // Mobile long-press to remove
            mousedown: () => startLongPress(i),
            mouseup: cancelLongPress,
            mouseleave: cancelLongPress,
          }}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            <span style={{ fontSize: "10px", fontWeight: "bold", color: "#d97706" }}>
              Waypoint {i + 1} · drag to move · right-click to remove
            </span>
          </Tooltip>
        </Marker>
      ))}

      {/* Guest view: show numbered markers (read-only) */}
      {!isHost && pinnedWaypoints.map((wp, i) => (
        <Marker
          key={`guest-pin-${i}`}
          position={[wp.lat, wp.lng]}
          icon={createNumberedIcon(i + 1)}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            <span style={{ fontSize: "10px", fontWeight: "bold", color: "#d97706" }}>
              Waypoint {i + 1}
            </span>
          </Tooltip>
        </Marker>
      ))}

      {/* Start and End markers */}
      <Marker position={[source.lat, source.lng]} icon={startIcon} />
      <Marker position={[destination.lat, destination.lng]} icon={endIcon} />
    </>
  );
}