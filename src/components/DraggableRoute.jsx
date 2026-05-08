// DraggableRoute.jsx — True Drag-Based Route Shaping Implementation
// Implements Google Maps style route dragging with hidden shaping points
// Replaces the arbitrary waypoint system with a premium, road-constrained interaction

import { useEffect, useState, useRef, useCallback } from "react";
import { Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { extractSegmentsFromRoute } from "../utils/routeHelpers";
import { getNearbyPOIs } from "../services/orsService";
import { useFirestoreDoc } from "../hooks/useFirestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;

// Premium Icons
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

// Ghost Shaping Point Icon
const ghostIcon = L.divIcon({
  className: "shaping-point-ghost",
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:rgba(99, 102, 241, 0.8);border:2px solid #fff;
    box-shadow:0 0 15px rgba(99, 102, 241, 0.6);
    cursor: grabbing;
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

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
  const [shapingPoint, setShapingPoint] = useState(null);
  const [ghostPoint, setGhostPoint] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [geometry, setGeometry] = useState([]);
  const [pois, setPois] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  
  const syncTimeoutRef = useRef(null);
  const lastFetchedWpsRef = useRef("");

  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);

  // Sync shaping point from Firestore (for Guest view)
  useEffect(() => {
    if (!isHost && sessionData?.shaping_point) {
      setShapingPoint(sessionData.shaping_point);
    }
  }, [isHost, sessionData?.shaping_point]);

  // Handle Dragging Interactions
  useEffect(() => {
    if (!isDragging || !isHost) return;

    const onMouseMove = (e) => {
      setGhostPoint(e.latlng);
    };

    const onMouseUp = async (e) => {
      setIsDragging(false);
      const finalizedPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
      setShapingPoint(finalizedPoint);
      setGhostPoint(null);
      map.dragging.enable();

      // Commit to Firestore
      if (sessionId) {
        try {
          const sessionRef = doc(db, "sessions", sessionId);
          await updateDoc(sessionRef, {
            shaping_point: finalizedPoint
          });
          console.log("[RouteShaper] Shaping point committed");
        } catch (err) {
          console.error("[RouteShaper] Sync failed:", err);
        }
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
  }, [isDragging, isHost, map, sessionId]);

  // Fetch Route from ORS
  useEffect(() => {
    const API_KEY = import.meta.env.VITE_ORS_API_KEY;
    if (!API_KEY || !source || !destination) return;

    const waypoints = [
      { lat: source.lat, lng: source.lng },
      ...(shapingPoint ? [shapingPoint] : []),
      { lat: destination.lat, lng: destination.lng }
    ];

    // Prevent duplicate fetches
    const wpString = JSON.stringify(waypoints);
    if (wpString === lastFetchedWpsRef.current) return;
    lastFetchedWpsRef.current = wpString;

    const fetchRoute = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY
          },
          body: JSON.stringify({
            coordinates: waypoints.map(w => [w.lng, w.lat])
          })
        });

        if (!res.ok) throw new Error(`ORS Error: ${res.status}`);

        const data = await res.json();
        const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setGeometry(coords);

        const summary = data.features[0].properties.summary;
        onRouteReady?.({ totalDistance: summary.distance, totalTime: summary.duration });

        if (coords.length > 0) {
          map.fitBounds(coords, { padding: [50, 50], animate: true });
        }

        // ORS A-Z: POIs (Fetch nearby amenities for local context)
        if (shapingPoint) {
          try {
            const poiData = await getNearbyPOIs(shapingPoint.lat, shapingPoint.lng);
            setPois(poiData.features || []);
          } catch (err) {
            console.error("POI search failed:", err);
          }
        }

        // Finalize state updates
        onRouteUpdated?.(waypoints);
        onSegmentDragged?.(extractSegmentsFromRoute(coords, 10)); // Extract segments from the actual road geometry

        // Sync Geometry for Guest
        if (isHost && sessionId) {
          await updateDoc(doc(db, "sessions", sessionId), {
            route_geometry: JSON.stringify(coords)
          });
        }
      } catch (err) {
        console.error("[RouteShaper] Fetch failed:", err);
        setFetchError("Route calculation failed. Try a different path.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoute();
  }, [source, destination, shapingPoint, isHost, sessionId, map, onRouteReady, onRouteUpdated, onSegmentDragged]);

  if (!source || !destination) return null;

  return (
    <>
      {/* Visual Error Message */}
      {fetchError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/80 backdrop-blur text-white px-4 py-2 rounded-lg border border-red-500 text-xs shadow-xl">
          {fetchError}
        </div>
      )}

      {/* Main Route Polyline */}
      {geometry.length > 0 && (
        <Polyline
          positions={geometry}
          pathOptions={{
            color: "#6366f1",
            weight: 6,
            opacity: isDragging ? 0.3 : 0.85,
            lineJoin: 'round'
          }}
          eventHandlers={{
            mousedown: (e) => {
              if (!isHost) return;
              L.DomEvent.stopPropagation(e);
              setIsDragging(true);
              setGhostPoint(e.latlng);
              map.dragging.disable();
            },
            mouseover: (e) => {
              if (isHost) e.target.setStyle({ color: '#818cf8', weight: 8 });
            },
            mouseout: (e) => {
              if (isHost) e.target.setStyle({ color: '#6366f1', weight: 6 });
            }
          }}
        >
          {isHost && !shapingPoint && (
            <Tooltip permanent={false} direction="top" opacity={0.9}>
              <span className="text-[10px] font-bold text-indigo-600">Drag route to reshape</span>
            </Tooltip>
          )}
        </Polyline>
      )}

      {/* Ghost Preview during Drag */}
      {isDragging && ghostPoint && (
        <>
          <Polyline
            positions={[
              [source.lat, source.lng],
              [ghostPoint.lat, ghostPoint.lng],
              [destination.lat, destination.lng]
            ]}
            pathOptions={{
              color: "#818cf8",
              weight: 3,
              dashArray: "10, 10",
              opacity: 0.6
            }}
          />
          <Marker position={ghostPoint} icon={ghostIcon} />
        </>
      )}

      {/* ORS A-Z: Nearby POIs (Contextual Intelligence) */}
      {pois.map((poi, i) => (
        <Marker 
          key={i} 
          position={[poi.geometry.coordinates[1], poi.geometry.coordinates[0]]}
          icon={L.divIcon({
            className: "",
            html: `<div style="background:#eab308;width:8px;height:8px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(234, 179, 8, 0.6);"></div>`
          })}
        >
          <Tooltip direction="top" offset={[0, -5]}>
            <span className="text-[10px] font-bold text-gray-200">Amenity: {poi.properties.label || "Service"}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* Origin & Destination Markers */}
      <Marker position={[source.lat, source.lng]} icon={startIcon} />
      <Marker position={[destination.lat, destination.lng]} icon={endIcon} />

      {/* Hidden Shaping Point (Visible only as a subtle handle) */}
      {shapingPoint && !isDragging && isHost && (
        <Marker
          position={[shapingPoint.lat, shapingPoint.lng]}
          icon={ghostIcon}
          draggable={true}
          eventHandlers={{
            dragstart: () => {
              setIsDragging(true);
              map.dragging.disable();
            },
            dragend: (e) => {
              const pos = e.target.getLatLng();
              setShapingPoint({ lat: pos.lat, lng: pos.lng });
              setIsDragging(false);
              map.dragging.enable();
            }
          }}
        >
           <Tooltip direction="bottom">Current shaping point</Tooltip>
        </Marker>
      )}
    </>
  );
}
