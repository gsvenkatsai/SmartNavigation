import { useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from "react-leaflet";
import { Activity, Navigation, ChevronDown, ChevronUp, AlertTriangle, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { DraggableRoute } from "./DraggableRoute";
import { VoiceAlert } from "./VoiceAlert";
import { SegmentHeatmap } from "./SegmentHeatmap";
import { writeSegmentPreference, useFirestoreDoc, clearCommunityData } from "../hooks/useFirestore";
import { runRouteIntelligence } from "../agents";
import { getIsochrones, getMatrix } from "../services/orsService";
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

function MapClickHandler({ onMapClick, disabled }) {
  useMapEvents({ 
    click(e) { 
      if (!disabled) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }); 
    } 
  });
  return null;
}

// Call ORS Pelias geocoder via proxy
async function geocode(query) {
  if (!query || query.length < 3) return [];
  const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;
  const url = `/ors-api/geocode/search?text=${encodeURIComponent(query)}&size=5&boundary.country=IN`;
  const res = await fetch(url, {
    headers: {
      'Authorization': ORS_KEY,
      'Accept': 'application/json, application/geo+json'
    }
  });
  const data = await res.json();
  return data.features || [];
}

function placeLabel(feature) {
  return feature.properties.name || feature.properties.label;
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
          {suggestions.map((p, idx) => (
            <button
              key={p.properties.id || idx}
              onMouseDown={() => onSelect(p)}
              onTouchStart={() => onSelect(p)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700 last:border-0"
            >
              <div className="text-gray-100 text-xs font-medium truncate">{placeLabel(p)}</div>
              <div className="text-gray-500 text-[10px] truncate">{p.properties.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MapView({ sessionId, isHost = true, initialSource = null }) {
  const isSharedSession = !!initialSource;
  const [source, setSource]           = useState(initialSource || BANGALORE);
  const [prevInitialSource, setPrevInitialSource] = useState(initialSource);

  if (initialSource !== prevInitialSource) {
    setPrevInitialSource(initialSource);
    setSource(initialSource);
    setSrcQuery("Shared Location");
  }

  const [destination, setDestination] = useState(null);
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [routeSummary, setRouteSummary] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [panelOpen, setPanelOpen]     = useState(true);

  // Place search state
  const [srcQuery, setSrcQuery]             = useState(initialSource ? "Shared Location" : "Bangalore City Centre");
  const [dstQuery, setDstQuery]             = useState("");
  const [srcSuggestions, setSrcSuggestions] = useState([]);
  const [dstSuggestions, setDstSuggestions] = useState([]);
  const [srcLoading, setSrcLoading]         = useState(false);
  const [dstLoading, setDstLoading]         = useState(false);
  const srcTimer = useRef(null);
  const dstTimer = useRef(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isochrone, setIsochrone]     = useState(null);
  const [efficiency, setEfficiency]   = useState(null);
  const [showDelayPopup, setShowDelayPopup] = useState(true);
  const processedSegments = useRef(new Set());

  // Firestore sync for Guest
  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);

  const [prevDelayFlag, setPrevDelayFlag] = useState(false);
  if (sessionData?.delay_flag && !prevDelayFlag) {
    setPrevDelayFlag(true);
    setShowDelayPopup(true);
  }

  const [prevWaypoints, setPrevWaypoints] = useState(null);
  if (!isHost && sessionData?.live_waypoints && JSON.stringify(sessionData.live_waypoints) !== JSON.stringify(prevWaypoints)) {
    setPrevWaypoints(sessionData.live_waypoints);
    const wps = sessionData.live_waypoints;
    if (wps.length >= 1) {
      setSource(wps[0]);
      setSrcQuery("Host Start");
      if (wps.length > 1) {
        setDestination(wps[wps.length - 1]);
        setDstQuery("Host Destination");
      }
    }
  }

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
    const [lng, lat] = place.geometry.coordinates;
    setSource({ lat, lng });
    setSrcQuery(placeLabel(place));
    setSrcSuggestions([]);
    setIsRouteReady(false);
    setRouteSummary(null);
  };

  const handleSelectDst = (place) => {
    const [lng, lat] = place.geometry.coordinates;
    setDestination({ lat, lng });
    setDstQuery(placeLabel(place));
    setDstSuggestions([]);
    setIsRouteReady(false);
    setRouteSummary(null);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported.");
      return;
    }
    setLocationError("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (isSharedSession) {
          // In shared session: host is the destination (guest comes to them)
          setDestination(myLoc);
          setDstQuery("My Location (Destination)");
          setDstSuggestions([]);
        } else {
          // Normal session: set as start
          setSource(myLoc);
          setSrcQuery("My Location");
          setSrcSuggestions([]);
        }
        setLocationError("");
        setIsRouteReady(false);
        setRouteSummary(null);
      },
      () => setLocationError("Location access denied.")
    );
  };

  const handleClearDst = () => {
    setDestination(null);
    setDstQuery("");
    setDstSuggestions([]);
    setIsRouteReady(false);
    setRouteSummary(null);
  };

  const handleRouteReady = useCallback((summary) => {
    setIsRouteReady(true);
    if (summary) setRouteSummary(summary);
  }, []);

  const handleRouteUpdated = useCallback(async (newWaypoints) => {
    if (isHost && sessionId) {
      try {
        const sessionRef = doc(db, "sessions", sessionId);
        await updateDoc(sessionRef, {
          live_waypoints: newWaypoints,
          ai_warning: "Recalculating community intelligence..."
        });
        
        runRouteIntelligence(sessionId, true).catch(err => console.error("AI Insight error:", err));

        if (source && destination && newWaypoints.length > 2) {
          try {
            const data = await getMatrix([source, destination]);
            setEfficiency({ 
              directSecs: data.durations[0][1],
              communitySecs: routeSummary?.totalTime || data.durations[0][1]
            });
          } catch (err) {
            console.error("Matrix failed:", err);
          }
        }
      } catch (err) {
        console.error("[MapView] Failed to sync with Firestore:", err);
      }
    }
  }, [isHost, sessionId, source, destination, routeSummary]);

  const handleSegmentDragged = useCallback(async (segmentIds) => {
    if (isHost) {
      for (const segId of segmentIds) {
        if (!processedSegments.current.has(segId)) {
          processedSegments.current.add(segId);
          writeSegmentPreference(segId).catch(err => console.error("Pref update error:", err));
        }
      }
    }
  }, [isHost]);

  const handleMapClick = useCallback(
    async (latlng) => {
      if (!destination && isHost) {
        setDestination(latlng);
        setDstQuery(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
        setIsRouteReady(false);
        setRouteSummary(null);
        
        try {
          const data = await getIsochrones(latlng.lat, latlng.lng, 300);
          setIsochrone(data.features[0].geometry.coordinates[0].map(c => [c[1], c[0]]));
        } catch (err) {
          console.error("Isochrone failed:", err);
        }
      }
    },
    [destination, isHost]
  );

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Floating Control Panel — collapsible on mobile */}
      <div className={`absolute top-2 left-2 sm:top-4 sm:left-4 bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-700 z-[1000] transition-all duration-300 ${panelOpen ? 'w-[85vw] sm:w-72 max-h-[75vh] overflow-y-auto' : 'w-auto'}`}>
        {/* Panel header — always visible, acts as toggle on mobile */}
        <div 
          className="w-full flex items-center justify-between p-3 sm:p-4 cursor-pointer"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Navigation size={16} className="text-indigo-400" />
            Route Planner
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowHeatmap(!showHeatmap); }}
              className={`p-1.5 rounded-lg border transition-all ${showHeatmap ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
              title="Toggle Community Heatmap"
            >
              <Activity size={14} />
            </button>
            <span className="sm:hidden text-gray-400">
              {panelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </div>
        </div>

        {/* Panel body */}
        {panelOpen && (
          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
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

                {routeSummary && (
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl p-3">
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Distance</span>
                        <span className="text-gray-100 text-sm font-semibold">
                          {routeSummary.totalDistance} km
                        </span>
                      </div>
                      <div className="w-px h-8 bg-gray-700" />
                      <div className="flex flex-col text-right">
                        <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Est. Time</span>
                        <span className="text-indigo-400 text-sm font-semibold">
                          {routeSummary.totalTime} min
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl py-1.5 px-3">
                      <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">⭐ Community Preferred Route</span>
                    </div>
                  </div>
                )}

                <button
                  id="my-location-btn"
                  onClick={handleMyLocation}
                  className={`w-full font-medium py-2.5 px-4 rounded-xl transition-all duration-200 text-sm border mb-2 ${
                    isSharedSession
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white border-indigo-500/30 shadow-lg shadow-indigo-500/20'
                      : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 border-gray-600'
                  }`}
                >
                  {isSharedSession ? '📍 Use My Location as Destination' : '◎ Use My Location as Start'}
                </button>

                {efficiency && (
                  <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold mb-1">Matrix Efficiency</div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Time Saved:</span>
                      <span className="text-green-400 font-bold text-sm">
                        {Math.max(0, Math.floor((efficiency.directSecs - efficiency.communitySecs) / 60))} min
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-green-500 h-full transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (efficiency.communitySecs / efficiency.directSecs) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {destination && (
                  <button
                    id="clear-dst-btn"
                    onClick={handleClearDst}
                    className="w-full bg-red-900/40 hover:bg-red-800/50 active:bg-red-700/50 text-red-300 font-medium py-2 px-4 rounded-xl transition-all duration-200 text-xs border border-red-800/40 mb-2 mt-3"
                  >
                    ✕ Clear Destination
                  </button>
                )}

                <button
                  onClick={async () => {
                    if (window.confirm("Clear all community intelligence data?")) {
                      await clearCommunityData();
                    }
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium py-1.5 px-4 rounded-xl transition-all duration-200 text-[10px] uppercase tracking-wider border border-gray-700 mt-2"
                >
                  Reset Community Heatmap
                </button>
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

            <p className="text-gray-500 text-[10px] text-center italic mt-2">
              {isHost 
                ? (destination ? "Tap route to add waypoint · Drag to reshape" : "Tap map to set destination")
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
        )}
      </div>

      {/* Leaflet Map */}
      <div className="flex-1 w-full h-full min-h-[400px]">
        <MapContainer
          center={[source.lat, source.lng]}
          zoom={13}
          className="w-full h-full"
          tap={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          <MapClickHandler onMapClick={handleMapClick} disabled={!isHost} />

          {/* ORS A-Z: Isochrone Overlay */}
          {isochrone && !isRouteReady && (
            <Polyline 
              positions={isochrone} 
              pathOptions={{ color: '#4f46e5', weight: 2, fill: true, fillColor: '#4f46e5', fillOpacity: 0.1, dashArray: '5, 5' }} 
            />
          )}

          {source && !destination && <Marker position={[source.lat, source.lng]} icon={startIcon} />}

          {showHeatmap && <SegmentHeatmap />}
          
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

      {/* PROACTIVE DELAY POPUP (MODAL) */}
      {sessionData && sessionData.delay_flag && showDelayPopup && source && destination && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-500/30 animate-in zoom-in-95 duration-300">
            <div className="bg-red-600 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 font-black uppercase tracking-tighter text-sm">
                <AlertTriangle size={18} />
                <span>Delay Detected</span>
              </div>
              <button onClick={() => setShowDelayPopup(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 text-center">
              <p className="text-gray-100 text-sm font-medium mb-8 leading-relaxed italic">"{sessionData.delay_message}"</p>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(sessionData.delay_message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-2xl transition shadow-lg shadow-green-500/20 active:scale-95"
              >
                <span>Notify via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
