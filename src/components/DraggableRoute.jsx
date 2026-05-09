// DraggableRoute.jsx — Multi-Waypoint Drag-Based Route Shaping
// Segment-aware dragging: drag A→B reroutes only that segment, B→C unchanged.

import { useEffect, useState, useRef } from "react";
import { Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { extractSegmentsFromRoute } from "../utils/routeHelpers";
import { getNearbyPOIs, fetchSegmentGeometry } from "../services/orsService";
import { useFirestoreDoc } from "../hooks/useFirestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

// ─── Icons ────────────────────────────────────────────────────────────────────

const createMarkerIcon = (color, label) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width:24px;height:24px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid white;
      transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:white;font-size:10px;font-weight:bold;">${label}</span>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });

const startIcon = createMarkerIcon("#22c55e", "S");
const endIcon   = createMarkerIcon("#ef4444", "D");

const ghostIcon = L.divIcon({
  className: "shaping-point-ghost",
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:rgba(99,102,241,0.8);border:2px solid #fff;
    box-shadow:0 0 15px rgba(99,102,241,0.6);cursor:grabbing;
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const pinnedIcon = L.divIcon({
  className: "pinned-waypoint",
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#f59e0b;border:2px solid #fff;
    box-shadow:0 0 10px rgba(245,158,11,0.7);cursor:grab;
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
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
    const fallback = [[from.lat, from.lng], [to.lat, to.lng]];
    segmentCache.set(key, fallback);
    return fallback;
  }
  segmentCache.set(key, coords);
  return coords;
}

// ─── Build full geometry from waypoints ──────────────────────────────────────
async function buildRouteFromWaypoints(allWaypoints) {
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
  const [dragging, setDragging] = useState(null);
  const [ghostPoint, setGhostPoint] = useState(null);
  const [pois, setPois] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const lastWpStringRef = useRef("");

  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);

  // ── Sync pinned waypoints from Firestore (Guest view) ──────────────────────
  useEffect(() => {
    if (!isHost && sessionData?.pinned_waypoints) {
      try {
        setPinnedWaypoints(JSON.parse(sessionData.pinned_waypoints));
      } catch {}
    }
  }, [isHost, sessionData?.pinned_waypoints]);

  // ── All waypoints: source + pins + destination ─────────────────────────────
  const allWaypoints = source && destination
    ? [{ lat: source.lat, lng: source.lng }, ...pinnedWaypoints, { lat: destination.lat, lng: destination.lng }]
    : [];

  // ── Rebuild route ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!source || !destination) return;
    const wpString = JSON.stringify(allWaypoints);
    if (wpString === lastWpStringRef.current) return;
    lastWpStringRef.current = wpString;

    setIsLoading(true);
    setFetchError(null);

    buildRouteFromWaypoints(allWaypoints)
      .then(({ segments, fullGeometry: fg }) => {
        setSegmentGeoms(segments);
        setFullGeometry(fg);
        const totalKm = geometryDistance(fg);
        onRouteReady?.({
          totalDistance: totalKm.toFixed(1),
          totalTime: Math.round((totalKm / 30) * 60),
        });
        onRouteUpdated?.(allWaypoints);
        onSegmentDragged?.(extractSegmentsFromRoute(fg, 10));
        if (fg.length > 0) map.fitBounds(fg, { padding: [50, 50], animate: true });
        if (isHost && sessionId) {
          updateDoc(doc(db, "sessions", sessionId), {
            route_geometry: JSON.stringify(fg),
            pinned_waypoints: JSON.stringify(pinnedWaypoints),
          }).catch(console.error);
        }
      })
      .catch((err) => {
        console.error("[DraggableRoute] Route build failed:", err);
        setFetchError("Route calculation failed. Try a different path.");
      })
      .finally(() => setIsLoading(false));
  }, [source, destination, pinnedWaypoints]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (dragging === null || !isHost) return;

    const onMouseMove = (e) => setGhostPoint(e.latlng);

    const onMouseUp = (e) => {
      const newPin = { lat: e.latlng.lat, lng: e.latlng.lng };
      const segIdx = dragging.segmentIndex;
      setDragging(null);
      setGhostPoint(null);
      map.dragging.enable();
      setPinnedWaypoints((prev) => {
        const updated = [...prev];
        updated.splice(segIdx, 0, newPin);
        return updated;
      });
    };

    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
    };
  }, [dragging, isHost, map]);

  // ── POIs around last pin ───────────────────────────────────────────────────
  useEffect(() => {
    const lastPin = pinnedWaypoints[pinnedWaypoints.length - 1];
    if (!lastPin) return;
    getNearbyPOIs(lastPin.lat, lastPin.lng)
      .then((d) => setPois(d.features || []))
      .catch(() => {});
  }, [pinnedWaypoints]);

  if (!source || !destination) return null;

  const segColors = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

  return (
    <>
      {fetchError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/80 backdrop-blur text-white px-4 py-2 rounded-lg border border-red-500 text-xs shadow-xl">
          {fetchError}
        </div>
      )}

      {segmentGeoms.map((segCoords, i) => {
        const color = segColors[i % segColors.length];
        const isDraggingThis = dragging?.segmentIndex === i;
        return (
          <Polyline
            key={`seg-${i}-${segCoords.length}`}
            positions={segCoords}
            pathOptions={{ color, weight: 6, opacity: isDraggingThis ? 0.25 : 0.85, lineJoin: "round" }}
            eventHandlers={{
              mousedown: (e) => {
                if (!isHost) return;
                L.DomEvent.stopPropagation(e);
                setDragging({ segmentIndex: i });
                setGhostPoint(e.latlng);
                map.dragging.disable();
              },
              mouseover: (e) => { if (isHost) e.target.setStyle({ color, weight: 9, opacity: 1 }); },
              mouseout:  (e) => { if (isHost) e.target.setStyle({ color, weight: 6, opacity: 0.85 }); },
            }}
          >
            {isHost && (
              <Tooltip sticky direction="top" opacity={0.9}>
                <span className="text-[10px] font-bold" style={{ color }}>
                  Drag to reshape segment {i + 1}
                </span>
              </Tooltip>
            )}
          </Polyline>
        );
      })}

      {dragging !== null && ghostPoint && (() => {
        const fromWp = allWaypoints[dragging.segmentIndex];
        const toWp   = allWaypoints[dragging.segmentIndex + 1];
        if (!fromWp || !toWp) return null;
        return (
          <>
            <Polyline
              positions={[[fromWp.lat, fromWp.lng], [ghostPoint.lat, ghostPoint.lng], [toWp.lat, toWp.lng]]}
              pathOptions={{ color: "#818cf8", weight: 3, dashArray: "10, 10", opacity: 0.7 }}
            />
            <Marker position={ghostPoint} icon={ghostIcon} />
          </>
        );
      })()}

      {isHost && pinnedWaypoints.map((wp, i) => (
        <Marker
          key={`pin-${i}`}
          position={[wp.lat, wp.lng]}
          icon={pinnedIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng();
              setPinnedWaypoints((prev) => {
                const updated = [...prev];
                updated[i] = { lat: pos.lat, lng: pos.lng };
                return updated;
              });
            },
            dblclick: () => {
              setPinnedWaypoints((prev) => prev.filter((_, j) => j !== i));
            },
          }}
        >
          <Tooltip direction="top">
            <span className="text-[10px] font-bold text-amber-400">
              Waypoint {i + 1} — drag to move · double-click to remove
            </span>
          </Tooltip>
        </Marker>
      ))}

      {pois.map((poi, i) => (
        <Marker
          key={`poi-${i}`}
          position={[poi.geometry.coordinates[1], poi.geometry.coordinates[0]]}
          icon={L.divIcon({
            className: "",
            html: `<div style="background:#eab308;width:8px;height:8px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(234,179,8,0.6);"></div>`,
          })}
        >
          <Tooltip direction="top" offset={[0, -5]}>
            <span className="text-[10px] font-bold text-gray-200">
              Amenity: {poi.properties.label || "Service"}
            </span>
          </Tooltip>
        </Marker>
      ))}

      <Marker position={[source.lat, source.lng]} icon={startIcon} />
      <Marker position={[destination.lat, destination.lng]} icon={endIcon} />
    </>
  );
}