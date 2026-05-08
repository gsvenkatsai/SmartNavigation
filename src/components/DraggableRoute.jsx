// DraggableRoute.jsx — Robust LRM + ORS Implementation with Stability Guards
// - Resolves 'length' TypeError with defensive checks
// - Uses L.latLng() factory for strict type safety
// - Implements L.Routing.openrouteservice with error handling

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import { extractSegmentsFromRoute } from "../utils/routeHelpers";
import { useFirestoreDoc } from "../hooks/useFirestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;

// Custom icons
const createMarkerIcon = (color, label) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:${color};border:3px solid white;
      transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:bold;">${label}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

const startIcon = createMarkerIcon("#22c55e", "A");
const endIcon   = createMarkerIcon("#ef4444", "B");
const viaIcon   = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#6366f1;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/**
 * Custom ORS Router for Leaflet Routing Machine
 */
L.Routing.OpenRouteService = L.Class.extend({
  initialize: function(apiKey, options) {
    this._apiKey = apiKey;
    this._options = L.extend({ timeout: 30000 }, options);
  },

  route: async function(waypoints, callback, context) {
    // Guard: Basic validation of input waypoints
    if (!waypoints || waypoints.length < 2 || !this._apiKey) {
      console.warn("[ORSRouter] Invalid waypoints or missing API key");
      callback.call(context, new Error("Invalid input for routing"));
      return;
    }

    const points = waypoints.map(w => [w.latLng.lng, w.latLng.lat]); // ORS wants [lng, lat]
    
    try {
      let url, body, method;
      
      if (points.length === 2) {
        method = 'GET';
        url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${this._apiKey}&start=${points[0][0]},${points[0][1]}&end=${points[1][0]},${points[1][1]}&radiuses=1000,1000`;
      } else {
        method = 'POST';
        url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
        body = JSON.stringify({ 
          coordinates: points,
          radiuses: points.map(() => 1000)
        });
      }

      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json', 'Authorization': this._apiKey } : {},
        body,
        signal: AbortSignal.timeout(this._options.timeout)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ORS API ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const feature = data.features?.[0];
      
      if (!feature || !feature.geometry || !feature.geometry.coordinates) {
        console.warn("[ORS Router] Invalid ORS response: missing geometry. Returning fallback empty route.");
        callback.call(context, null, []);
        return;
      }

      const coords = feature.geometry.coordinates.map(c => L.latLng(c[1], c[0]));
      const summary = feature.properties?.summary || { distance: 0, duration: 0 };

      const route = {
        name: "SmartNav Route",
        summary: { totalDistance: summary.distance, totalTime: summary.duration },
        coordinates: coords,
        waypoints: waypoints,
        instructions: []
      };

      callback.call(context, null, [route]);
    } catch (err) {
      console.error("[ORS Router Error]:", err);
      callback.call(context, null, []);
    }
  }
});

L.Routing.openrouteservice = function(apiKey, options) {
  return new L.Routing.OpenRouteService(apiKey, options);
};

function RoutingEngine({
  waypoints,
  sessionId,
  isHost,
  onRouteReady,
  onRouteUpdated,
  onSegmentDragged,
}) {
  const map = useMap();
  const instance = useRef(null);
  const syncTimeoutRef = useRef(null);
  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return;

    if (instance.current) {
      try {
        map.removeControl(instance.current);
      } catch (e) {
        console.warn("[LRM Cleanup Warning]:", e);
      }
    }

    let routingControl;
    
    try {
      routingControl = L.Routing.control({
        plan: L.Routing.plan(waypoints.map(wp => L.latLng(wp.lat, wp.lng)), {
          createMarker: (i, wp, n) => {
            return L.marker(wp.latLng, {
              draggable: isHost,
              icon: i === 0 ? startIcon : (i === n - 1 ? endIcon : viaIcon)
            });
          },
          addWaypoints: isHost,
          draggableWaypoints: isHost,
        }),
        router: L.Routing.openrouteservice(ORS_KEY, { timeout: 30000 }),
        lineOptions: {
          styles: [{ color: "#6366f1", weight: 6, opacity: 0.85 }],
          addWaypoints: isHost
        },
        show: false,
        addWaypoints: isHost
      }).addTo(map);

      instance.current = routingControl;

      // waypointschanged event: Update Firestore live_waypoints
      routingControl.on('waypointschanged', (e) => {
        if (!isHost || !sessionId || !e.waypoints) return;
        
        const validWaypoints = e.waypoints.filter(w => w && w.latLng);
        if (validWaypoints.length < 2) return;

        const wps = validWaypoints.map(w => ({
          lat: w.latLng.lat,
          lng: w.latLng.lng
        }));

        // Throttled sync to prevent race conditions during remount
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(async () => {
          try {
            const sessionRef = doc(db, "sessions", sessionId);
            await updateDoc(sessionRef, {
              live_waypoints: wps
            });
            console.log("[LRM] Waypoints updated in Firestore");
            onRouteUpdated?.(wps);
            onSegmentDragged?.(extractSegmentsFromRoute(wps));
          } catch (err) {
            console.error("[LRM] Firestore update failed:", err);
          }
        }, 1000);
      });

      routingControl.on('routeselected', async (e) => {
        // Defensive check before accessing coordinates length
        if (!e.route || !e.route.coordinates) return;
        
        onRouteReady?.();
        if (isHost && sessionId) {
          const geometry = e.route.coordinates.map(c => [c.lat, c.lng]);
          try {
            const sessionRef = doc(db, "sessions", sessionId);
            await updateDoc(sessionRef, {
              route_geometry: JSON.stringify(geometry)
            });
          } catch (err) {
            console.error("[LRM] Geometry sync failed:", err);
          }
        }
      });
    } catch (err) {
      console.error("[LRM Initialization Error]:", err);
    }

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (instance.current) {
        try {
          map.removeControl(instance.current);
        } catch (e) {
          console.warn("[LRM Cleanup Warning]:", e);
        }
        instance.current = null;
      }
    };
  }, [map, isHost, sessionId]); // waypoints change triggers remount via key prop in parent

  // Guest Sync
  useEffect(() => {
    if (!isHost && sessionData?.live_waypoints && instance.current) {
      try {
        const newWps = sessionData.live_waypoints.map(w => L.latLng(w.lat, w.lng));
        const currentWps = instance.current.getWaypoints().map(w => w.latLng);
        
        const hasChanged = newWps.length !== currentWps.length || 
                           newWps.some((wp, i) => !wp.equals(currentWps[i]));

        if (hasChanged) {
          instance.current.setWaypoints(newWps);
        }
      } catch (err) {
        console.error("[LRM Guest Sync Error]:", err);
      }
    }
  }, [isHost, sessionData?.live_waypoints]);

  if (hasError) {
    return <div className="absolute top-4 left-4 z-[1000] p-2 bg-red-100 text-red-600 rounded shadow">Error loading route</div>;
  }

  return null;
}

export function DraggableRoute({
  source,
  destination,
  sessionId,
  isHost = true,
  onRouteReady,
  onRouteUpdated,
  onSegmentDragged,
}) {
  const waypoints = (source && destination)
    ? [L.latLng(source.lat, source.lng), L.latLng(destination.lat, destination.lng)]
    : null;

  return waypoints && waypoints.length >= 2 && ORS_KEY ? (
    <RoutingEngine
      key={`${source.lat}-${source.lng}-${destination.lat}-${destination.lng}`}
      waypoints={waypoints}
      sessionId={sessionId}
      isHost={isHost}
      onRouteReady={onRouteReady}
      onRouteUpdated={onRouteUpdated}
      onSegmentDragged={onSegmentDragged}
    />
  ) : null;
}
