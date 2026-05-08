// main.jsx — React entry point
// Includes Leaflet default icon fix to prevent broken icon images

import React from "react";
import ReactDOM from "react-dom/client";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App";

// Fix Leaflet's default icon URL resolution issue in Vite/webpack environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
