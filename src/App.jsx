// App.jsx — Root component with Routing

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import HostView from "./components/HostView";
import GuestView from "./components/GuestView";
import AIDashboard from "./components/AIDashboard";
import { MapView } from "./components/MapView";

export default function App() {
  return (
    <Router>
      <div className="h-screen flex flex-col bg-gray-950 overflow-hidden text-gray-100">
        {/* Top Navbar */}
        <nav className="flex items-center justify-between px-6 py-3 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 shrink-0 z-50">
          <div className="flex items-center gap-3">
            {/* Logo / Brand */}
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white text-sm font-bold">⬡</span>
            </div>
            <div>
              <h1
                className="font-bold text-xl tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                SmartNav
              </h1>
              <p className="text-gray-500 text-xs -mt-0.5 tracking-wide">
                Community-Powered Navigation
              </p>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-medium">Live</span>
            </div>
          </div>
        </nav>

        {/* Routes */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host" element={<HostView />} />
            <Route path="/join/:sessionId" element={<GuestView />} />
            <Route path="/dashboard" element={<AIDashboard />} />
            {/* Legacy MapView path for standalone testing if needed */}
            <Route path="/map" element={<MapView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
