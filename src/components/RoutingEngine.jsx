// RoutingEngine.jsx — Calls OpenRouteService API and returns route geometry

import { useEffect, useState } from "react";
import axios from "axios";

export function RoutingEngine({ source, destination, onRouteReady }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error | done

  useEffect(() => {
    if (!source || !destination) return;

    const fetchRoute = async () => {
      setStatus("loading");
      try {
        const response = await axios.get(
          "https://api.openrouteservice.org/v2/directions/driving-car",
          {
            params: {
              api_key: import.meta.env.VITE_ORS_API_KEY,
              // Switched back to [lng, lat] for ORS compatibility
              start: `${source.lng},${source.lat}`,
              end: `${destination.lng},${destination.lat}`,
              radiuses: "1000,1000"
            },
          }
        );

        const feature = response.data.features?.[0];
        if (!feature) throw new Error("No route feature returned");

        const geometry = feature.geometry;
        // ORS returns [lng, lat] — map to {lat, lng} for internal consistency
        const routeCoords = geometry.coordinates.map(([lng, lat]) => ({
          lat,
          lng,
        }));

        console.log("[RoutingEngine] Route ready:", routeCoords.length, "points");
        onRouteReady(routeCoords, routeCoords);
        setStatus("done");
      } catch (err) {
        console.error("[RoutingEngine] ORS API error:", err.response?.data || err.message);
        setStatus("error");
      }
    };

    fetchRoute();
  }, [source, destination, onRouteReady]);

  return (
    <div className="hidden">
      {status === "loading" && <span>Loading route...</span>}
    </div>
  );
}
