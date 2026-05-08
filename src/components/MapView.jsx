// MapView.jsx — Main map container with Collaborative Routing

import { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { DraggableRoute } from "./DraggableRoute";
import { VoiceAlert } from "./VoiceAlert";
import { SegmentHeatmap } from "./SegmentHeatmap";
import { writeSegmentPreference, useFirestoreDoc } from "../hooks/useFirestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

const BANGALORE = { lat: 12.9716, lng: 77.5946 };

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

function MapClickHandler({ onMapClick, disabled }) {
  useMapEvents({ 
    click(e) { 
      if (!disabled) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }); 
    } 
  });
  return null;
}

// Call Nominatim geocoder
async function geocode(query) {
  if (!query || query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  return await res.json();
}

// Short display label from Nominatim result
function placeLabel(p) {
  const parts = p.display_name.split(",");
  return parts.slice(0, 2).join(",").trim();
}

// Search input with dropdown
function PlaceSearch({ id, label, icon, value, onChange, onSelect, suggestions, loading, disabled }) {
  return (
    <div className="relative mb-2">
      <span className="text-gray-400 text-xs mb-1 block">{label}</span>
      <div className={`flex items-center gap-1.5 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 ${!disabled && 'focus-within:border-indigo-500'} transition-colors ${disabled && 'opacity-50 cursor-not-allowed'}`}>
        <span className="text-gray-400 text-sm shrink-0">{icon}</span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={disabled ? "Locked" : "Search place…"}
          className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 focus:outline-none min-w-0"
          autoComplete="off"
          disabled={disabled}
        />
        {loading && (
          <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
      </div>

      {/* Dropdown suggestions */}
      {!disabled && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-[2000] max-h-52 overflow-y-auto">
          {suggestions.map((p) => (
            <button
              key={p.place_id}
              onMouseDown={() => onSelect(p)}   // mouseDown fires before onBlur
              className="w-full text-left px-3 py-2.5 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
            >
              <div className="text-gray-100 text-xs font-medium truncate">{placeLabel(p)}</div>
              <div className="text-gray-500 text-[10px] truncate">{p.display_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MapView({ sessionId, isHost = true }) {
  const [source, setSource]           = useState(BANGALORE);
  const [destination, setDestination] = useState(null);
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Place search state
  const [srcQuery, setSrcQuery]             = useState("Bangalore City Centre");
  const [dstQuery, setDstQuery]             = useState("");
  const [srcSuggestions, setSrcSuggestions] = useState([]);
  const [dstSuggestions, setDstSuggestions] = useState([]);
  const [srcLoading, setSrcLoading]         = useState(false);
  const [dstLoading, setDstLoading]         = useState(false);
  const srcTimer = useRef(null);
  const dstTimer = useRef(null);

  // Firestore sync for Guest
  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);

  useEffect(() => {
    if (!isHost && sessionData?.live_waypoints?.length >= 1) {
      const wps = sessionData.live_waypoints;
      setSource(wps[0]);
      if (wps.length > 1) {
        setDestination(wps[wps.length - 1]);
      }
      // Note: viaPoints are handled by DraggableRoute's internal sync if we pass them
    }
  }, [isHost, sessionData?.live_waypoints]);

  // Debounced search
  const handleSrcChange = (val) => {
    setSrcQuery(val);
    setSrcSuggestions([]);
    clearTimeout(srcTimer.current);
    if (val.length < 3) return;
    setSrcLoading(true);
    srcTimer.current = setTimeout(async () => {
      const results = await geocode(val);
      setSrcSuggestions(results);
      setSrcLoading(false);
    }, 400);
  };

  const handleDstChange = (val) => {
    setDstQuery(val);
    setDstSuggestions([]);
    clearTimeout(dstTimer.current);
    if (val.length < 3) return;
    setDstLoading(true);
    dstTimer.current = setTimeout(async () => {
      const results = await geocode(val);
      setDstSuggestions(results);
      setDstLoading(false);
    }, 400);
  };

  const handleSelectSrc = (place) => {
    const newSource = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
    setSource(newSource);
    setSrcQuery(placeLabel(place));
    setSrcSuggestions([]);
    setIsRouteReady(false);
  };

  const handleSelectDst = (place) => {
    const newDest = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
    setDestination(newDest);
    setDstQuery(placeLabel(place));
    setDstSuggestions([]);
    setIsRouteReady(false);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported.");
      return;
    }
    setLocationError("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newSource = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSource(newSource);
        setSrcQuery("My Location");
        setSrcSuggestions([]);
        setLocationError("");
        setIsRouteReady(false);
      },
      () => setLocationError("Location access denied.")
    );
  };

  const handleClearDst = () => {
    setDestination(null);
    setDstQuery("");
    setDstSuggestions([]);
    setIsRouteReady(false);
  };

  const handleRouteReady = useCallback(() => setIsRouteReady(true), []);

  const handleRouteUpdated = useCallback(async (newWaypoints) => {
    if (isHost && sessionId) {
      try {
        const sessionRef = doc(db, "sessions", sessionId);
        await updateDoc(sessionRef, {
          live_waypoints: newWaypoints,
        });
        console.log("[MapView] Firestore updated with", newWaypoints.length, "waypoints");
      } catch (err) {
        console.error("[MapView] Failed to sync with Firestore:", err);
      }
    }
  }, [isHost, sessionId]);

  const handleSegmentDragged = useCallback(async (segmentIds) => {
    if (isHost) {
      for (const segId of segmentIds) await writeSegmentPreference(segId);
    }
  }, [isHost]);

  const handleMapClick = useCallback(
    (latlng) => {
      if (!destination && isHost) {
        setDestination(latlng);
        setDstQuery(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
        setIsRouteReady(false);
      }
    },
    [destination, isHost]
  );

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Floating Control Panel */}
      <div
        className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-700 w-72 z-[1000]"
      >
        <h2 className="text-gray-100 font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="text-indigo-400">⬡</span> {isHost ? "Host Planner" : "Live Following"}
        </h2>

        {isHost ? (
          <>
            <PlaceSearch
              id="source-search"
              label="From"
              icon="🟢"
              value={srcQuery}
              onChange={handleSrcChange}
              onSelect={handleSelectSrc}
              suggestions={srcSuggestions}
              loading={srcLoading}
              disabled={!isHost}
            />

            <PlaceSearch
              id="destination-search"
              label="To"
              icon="🔴"
              value={dstQuery}
              onChange={handleDstChange}
              onSelect={handleSelectDst}
              suggestions={dstSuggestions}
              loading={dstLoading}
              disabled={!isHost}
            />

            <button
              id="my-location-btn"
              onClick={handleMyLocation}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-xl transition-all duration-200 text-sm border border-gray-600 mb-2"
            >
              ◎ Use My Location as Start
            </button>

            {destination && (
              <button
                id="clear-dst-btn"
                onClick={handleClearDst}
                className="w-full bg-red-900/40 hover:bg-red-800/50 text-red-300 font-medium py-1.5 px-4 rounded-xl transition-all duration-200 text-xs border border-red-800/40 mb-2"
              >
                ✕ Clear Destination
              </button>
            )}
          </>
        ) : (
          <div className="space-y-2 mb-3">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
              <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 text-xs font-bold">Following Host Live</span>
              </div>
            </div>
            {sessionData?.guest_route && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-1">Route</p>
                <p className="text-gray-100 text-xs font-medium">{sessionData.guest_route}</p>
              </div>
            )}
          </div>
        )}

        <p className="text-gray-500 text-[10px] text-center italic">
          {isHost 
            ? (destination ? "Click route to add waypoint · Drag to reroute" : "Click map to set destination")
            : "Viewing host movement in real-time"
          }
        </p>

        {locationError && (
          <p className="text-red-400 text-[10px] mt-2 text-center">{locationError}</p>
        )}

        {isRouteReady && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-medium uppercase tracking-tighter">Route Active</span>
          </div>
        )}
      </div>

      {/* Leaflet Map */}
      <div className="flex-1 w-full h-full min-h-[400px]">
        <MapContainer
          center={[BANGALORE.lat, BANGALORE.lng]}
          zoom={13}
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          <MapClickHandler onMapClick={handleMapClick} disabled={!isHost} />

          {/* Only show source marker if destination is not yet set. Once both exist, DraggableRoute (LRM) handles all markers. */}
          {source && !destination && <Marker position={[source.lat, source.lng]} icon={startIcon} />}

          <SegmentHeatmap />

          {/* DraggableRoute: renders + draws route + handles drag via ORS */}
          {source && destination && (
            <DraggableRoute
              key={`${source.lat}-${source.lng}-${destination.lat}-${destination.lng}`}
              source={source}
              destination={destination}
              sessionId={sessionId}
              isHost={isHost}
              onRouteReady={handleRouteReady}
              onRouteUpdated={handleRouteUpdated}
              onSegmentDragged={handleSegmentDragged}
            />
          )}
        </MapContainer>
      </div>

      <VoiceAlert sessionId={sessionId || "session-host-guest-101"} autoSpeak={true} />
    </div>
  );
}
