import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, sessionsCollection } from '../services/firebase';
import { Share2, ArrowLeft, Loader2, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MapView } from './MapView';
import { runRouteIntelligence } from '../agents';

export default function HostView() {
  const [sessionId, setSessionId] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initializeSession = async () => {
      // Generate a simple random session ID
      const newSessionId = Math.random().toString(36).substring(2, 9).toUpperCase();
      setSessionId(newSessionId);

      const newSession = {
        session_id: newSessionId,
        host_id: 'host_' + newSessionId, // Simple host identification
        guest_route: 'Live SmartNav Route',
        live_waypoints: [{ lat: 12.9716, lng: 77.5946 }], // Start at Bangalore roughly
        route_geometry: '',
        status: 'active',
        ai_warning: 'None',
        delay_flag: false,
        delay_message: '',
        why_avoid_text: ''
      };

      try {
        await setDoc(doc(sessionsCollection, newSessionId), newSession);
        // Fire and forget AI intelligence to prevent blocking initialization
        runRouteIntelligence(newSessionId).catch(err => console.error("Initial AI run failed:", err));
      } catch (err) {
        console.error("Failed to init session:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, []);

  const handleCopy = () => {
    const url = `${window.location.origin}/join/${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-gray-400 font-medium">Initializing Host Session...</p>
      </div>
    );
  }

  const shareLink = `https://wa.me/?text=${encodeURIComponent(`Join my SmartNav session: ${window.location.origin}/join/${sessionId}`)}`;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Host Sub-header */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-white font-bold text-sm">Host Mode</h2>
            <p className="text-gray-500 text-[10px] font-mono tracking-widest">{sessionId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 px-3 rounded-lg border border-gray-700 transition-all active:scale-95"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span>{copied ? "Copied!" : "Copy Link"}</span>
          </button>
          
          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs py-1.5 px-3 rounded-lg border border-green-600/30 transition-all active:scale-95"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative">
        <MapView sessionId={sessionId} isHost={true} />
      </div>
    </div>
  );
}
