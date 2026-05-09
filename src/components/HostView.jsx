import { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, sessionsCollection } from '../services/firebase';
import { Share2, ArrowLeft, Loader2, Copy, Check, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MapView } from './MapView';
import { runRouteIntelligence } from '../agents';

export default function HostView() {
  const { sessionId: sharedSessionId } = useParams(); // If coming from a shared location link
  const [sessionId, setSessionId] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [copied, setCopied] = useState(false);
  const [guestStart, setGuestStart] = useState(null); // Guest's shared location
  const [isSharedSession, setIsSharedSession] = useState(false);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Check if this is a shared session (guest shared their location)
        if (sharedSessionId) {
          const existingDoc = await getDoc(doc(db, "sessions", sharedSessionId));
          if (existingDoc.exists()) {
            const data = existingDoc.data();
            if (data.guest_start) {
              // This is a shared location session — host is opening the guest's link
              setSessionId(sharedSessionId);
              setGuestStart(data.guest_start);
              setIsSharedSession(true);
              // Update session status to active
              await updateDoc(doc(db, "sessions", sharedSessionId), {
                host_id: 'host_' + sharedSessionId,
                status: 'active',
              });
              setIsInitializing(false);
              return;
            }
          }
        }

        // Normal host session creation
        const newSessionId = Math.random().toString(36).substring(2, 9).toUpperCase();
        setSessionId(newSessionId);

        const newSession = {
          session_id: newSessionId,
          host_id: 'host_' + newSessionId,
          guest_route: 'Live SmartNav Route',
          live_waypoints: [{ lat: 12.9716, lng: 77.5946 }],
          route_geometry: '',
          pinned_waypoints: '[]',
          status: 'active',
          ai_warning: 'None',
          delay_flag: false,
          delay_message: '',
          why_avoid_text: ''
        };

        await setDoc(doc(sessionsCollection, newSessionId), newSession);
        runRouteIntelligence(newSessionId).catch(err => console.error("Initial AI run failed:", err));
      } catch (err) {
        console.error("Failed to init session:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, [sharedSessionId]);

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
        <p className="text-gray-400 font-medium">
          {sharedSessionId ? "Loading shared location..." : "Initializing Host Session..."}
        </p>
      </div>
    );
  }

  const shareLink = `https://wa.me/?text=${encodeURIComponent(`Join my SmartNav session: ${window.location.origin}/join/${sessionId}`)}`;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Host Sub-header */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-white font-bold text-sm">Host Mode</h2>
            <div className="flex items-center gap-2">
              <p className="text-gray-500 text-[10px] font-mono tracking-widest">{sessionId}</p>
              {isSharedSession && (
                <span className="bg-green-500/10 text-green-400 text-[8px] px-1.5 py-0.5 rounded border border-green-500/20 font-bold uppercase">
                  <MapPin size={8} className="inline mr-0.5" /> Shared
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1 sm:gap-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 text-xs py-1.5 px-2 sm:px-3 rounded-lg border border-gray-700 transition-all active:scale-95"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy Link"}</span>
          </button>
          
          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-2 bg-green-600/20 hover:bg-green-600/30 active:bg-green-600/40 text-green-400 text-xs py-1.5 px-2 sm:px-3 rounded-lg border border-green-600/30 transition-all active:scale-95"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Shared location banner */}
      {isSharedSession && guestStart && (
        <div className="bg-green-900/30 border-b border-green-800/30 px-4 py-2 flex items-center gap-2 z-10">
          <MapPin size={14} className="text-green-400 shrink-0" />
          <p className="text-green-300 text-xs">
            Someone wants to come to you! They shared their location. 
            <span className="text-green-400 font-bold"> Tap "Use My Location as Destination" to guide them to your place.</span>
          </p>
        </div>
      )}

      {/* Map Content */}
      <div className="flex-1 relative">
        <MapView 
          sessionId={sessionId} 
          isHost={true} 
          initialSource={guestStart}
        />
      </div>
    </div>
  );
}
