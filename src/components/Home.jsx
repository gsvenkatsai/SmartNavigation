import { Link, useNavigate } from 'react-router-dom';
import { Navigation, Database, Bot, MapPin, Loader2, Copy, Check, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { seedDemoData } from '../utils/seeder';
import { doc, setDoc } from 'firebase/firestore';
import { db, sessionsCollection } from '../services/firebase';

export default function Home() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareModal, setShareModal] = useState(null); // { url, sessionId }
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDemoData();
    setIsSeeding(false);
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setShareError("Geolocation is not supported by your browser.");
      return;
    }
    setIsSharing(true);
    setShareError("");
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const sessionId = Math.random().toString(36).substring(2, 9).toUpperCase();
          const session = {
            session_id: sessionId,
            host_id: '',
            guest_route: 'Shared Location Route',
            live_waypoints: [{ lat: pos.coords.latitude, lng: pos.coords.longitude }],
            guest_start: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            route_geometry: '',
            pinned_waypoints: '[]',
            status: 'pending_host',
            ai_warning: 'None',
            delay_flag: false,
            delay_message: '',
            why_avoid_text: ''
          };
          await setDoc(doc(sessionsCollection, sessionId), session);
          
          const shareUrl = `${window.location.origin}/host/${sessionId}`;
          setShareModal({ url: shareUrl, sessionId });
        } catch (err) {
          console.error("Failed to share location:", err);
          setShareError("Failed to share location. Try again.");
        } finally {
          setIsSharing(false);
        }
      },
      () => {
        setIsSharing(false);
        setShareError("Location access denied. Please enable location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCopyLink = async () => {
    if (!shareModal) return;
    try {
      await navigator.clipboard.writeText(shareModal.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
      const input = document.createElement('input');
      input.value = shareModal.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    if (!shareModal) return;
    const msg = `📍 I'm sharing my location via SmartNav!\nOpen this link to guide me to your place:\n${shareModal.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleGoToGuestView = () => {
    if (shareModal) {
      navigate(`/join/${shareModal.sessionId}`);
      setShareModal(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-gray-950 text-gray-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <header className="mb-10 text-center w-full relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-5">
          <span className="text-4xl font-bold text-white">⬡</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-3" style={{
          background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 40%, #c084fc 70%, #e879f9 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          SmartNav
        </h1>
        <p className="text-gray-400 font-medium tracking-wide text-sm sm:text-base">
          Community-Powered Real-Time Navigation
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-[10px] font-bold uppercase tracking-[0.15em]">Live System Active</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full space-y-3 max-w-sm relative z-10">
        {/* Start as Host */}
        <Link
          to="/host"
          className="group w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:from-indigo-700 active:to-indigo-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all duration-300 active:scale-[0.97]"
        >
          <Navigation size={20} className="group-hover:rotate-12 transition-transform" />
          <span>Start as Host</span>
        </Link>

        {/* Share My Location */}
        <button
          onClick={handleShareLocation}
          disabled={isSharing}
          className="group w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 active:from-emerald-700 active:to-green-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-green-500/25 transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSharing ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Getting Location...</span>
            </>
          ) : (
            <>
              <MapPin size={20} className="group-hover:bounce transition-transform" />
              <span>Share My Location</span>
            </>
          )}
        </button>

        {shareError && (
          <p className="text-red-400 text-xs text-center bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-2 w-full">{shareError}</p>
        )}
        
        {/* AI Dashboard */}
        <Link
          to="/dashboard"
          className="group w-full flex items-center justify-center space-x-3 bg-gray-900/80 border border-gray-700/50 hover:border-indigo-500/50 hover:bg-gray-800/80 active:bg-gray-700/80 text-indigo-400 font-bold py-4 px-6 rounded-2xl shadow-sm transition-all duration-300 active:scale-[0.97] backdrop-blur-sm"
        >
          <Bot size={20} className="group-hover:rotate-6 transition-transform" />
          <span>AI Intelligence Dashboard</span>
        </Link>
        
        {/* Dev Tools */}
        <div className="w-full bg-gray-900/40 p-5 rounded-2xl shadow-sm border border-gray-800/50 text-center mt-6 backdrop-blur-sm">
          <h2 className="text-sm font-semibold mb-2 flex items-center justify-center text-gray-400">
            <Database size={14} className="mr-2 text-indigo-500" />
            Developer Tools
          </h2>
          <p className="text-[9px] text-gray-600 mb-3 uppercase tracking-widest font-bold">
            Populate Firestore with demo data
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full bg-gray-800/80 hover:bg-gray-700/80 active:bg-gray-600/80 text-gray-400 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 active:scale-[0.97] text-xs border border-gray-700/50"
          >
            {isSeeding ? 'Seeding Data...' : 'Seed Demo Data'}
          </button>
        </div>
      </main>
      
      <footer className="mt-10 text-center text-[9px] text-gray-700 uppercase tracking-[0.2em] font-bold relative z-10">
        SmartNav · Community-Powered Navigation · 2026
      </footer>

      {/* ─── Share Modal ─── */}
      {shareModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 pb-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-500/20 flex items-center justify-center">
                  <MapPin size={20} className="text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Location Shared!</h3>
                  <p className="text-gray-500 text-[10px] font-mono tracking-wider">{shareModal.sessionId}</p>
                </div>
              </div>
              <button
                onClick={() => setShareModal(null)}
                className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Link preview */}
            <div className="mx-5 mt-4 bg-gray-800/80 border border-gray-700 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Share Link</p>
              <p className="text-indigo-400 text-xs font-mono break-all leading-relaxed">{shareModal.url}</p>
            </div>

            {/* Share actions */}
            <div className="p-5 space-y-3">
              <p className="text-gray-400 text-xs text-center mb-1">Send this link to the person guiding you</p>

              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-100 font-semibold py-3 px-4 rounded-xl border border-gray-700 transition-all active:scale-[0.97]"
              >
                {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                <span>{copied ? "Link Copied!" : "Copy Link"}</span>
              </button>

              <button
                onClick={handleWhatsAppShare}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 active:from-green-700 active:to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-green-500/20 transition-all active:scale-[0.97]"
              >
                <Share2 size={18} />
                <span>Share via WhatsApp</span>
              </button>

              <div className="border-t border-gray-800 pt-3 mt-1">
                <button
                  onClick={handleGoToGuestView}
                  className="w-full flex items-center justify-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium py-2 text-sm transition-colors"
                >
                  <Navigation size={14} />
                  <span>Continue to follow route →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
