import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, sessionsCollection } from '../services/firebase';
import { Share2, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HostView() {
  const [sessionId, setSessionId] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      // Generate a simple random session ID
      const newSessionId = Math.random().toString(36).substring(2, 9);
      setSessionId(newSessionId);

      const newSession = {
        session_id: newSessionId,
        guest_route: 'Pending Guest Route',
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
      } catch (err) {
        console.error("Failed to init session:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, []);

  const handleSimulateDrag = async () => {
    if (!sessionId) return;
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      // Create some random new waypoints
      const randomLat = 12.9716 + (Math.random() - 0.5) * 0.05;
      const randomLng = 77.5946 + (Math.random() - 0.5) * 0.05;
      
      await updateDoc(sessionDocRef, {
        live_waypoints: [
          { lat: randomLat, lng: randomLng },
          { lat: randomLat + 0.005, lng: randomLng + 0.005 }
        ]
      });
      // Optionally provide brief UI feedback without alert blocking the thread entirely
      console.log('Simulated drag! Waypoints updated in Firestore.');
    } catch (err) {
      console.error('Failed to update waypoints:', err);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-gray-500">Initializing Session...</p>
      </div>
    );
  }

  const shareLink = `https://wa.me/?text=${encodeURIComponent(`Join my SmartNav session ${window.location.origin}/join/${sessionId}`)}`;

  return (
    <div className="flex flex-col min-h-screen p-6 relative bg-gray-50">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="p-2 bg-white rounded-full shadow-sm text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Host Dashboard</h1>
        <div className="w-9"></div> {/* Spacer for centering */}
      </header>

      <main className="flex-1 flex flex-col space-y-6 max-w-md mx-auto w-full">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-1">Active Session ID</p>
          <p className="text-3xl font-mono font-bold text-blue-600 mb-6">{sessionId}</p>

          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-xl shadow-md transition duration-200 active:scale-95"
          >
            <Share2 size={18} />
            <span>Share via WhatsApp</span>
          </a>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <MapPin size={24} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Day 0 Testing</h2>
          <p className="text-sm text-gray-500 mb-6">
            Since the map UI isn't ready, use this button to simulate moving along a route. It will instantly update the `live_waypoints` array.
          </p>

          <button
            onClick={handleSimulateDrag}
            className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium py-3 px-4 rounded-xl shadow-sm transition duration-200 active:scale-95 border border-blue-200"
          >
            Simulate Drag
          </button>
        </div>
      </main>
    </div>
  );
}
