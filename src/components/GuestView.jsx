import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Loader2, ArrowLeft, Navigation2, AlertTriangle } from 'lucide-react';

export default function GuestView() {
  const { sessionId } = useParams();
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided.");
      return;
    }

    const sessionDocRef = doc(db, 'sessions', sessionId);
    
    // Set up the real-time listener
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSessionData(docSnap.data());
      } else {
        setError("Session not found or has ended.");
      }
    }, (err) => {
      console.error("Error listening to session:", err);
      setError("Failed to connect to real-time session.");
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link to="/" className="text-blue-600 font-medium hover:underline flex items-center justify-center">
          <ArrowLeft size={16} className="mr-1" /> Return Home
        </Link>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-gray-500">Connecting to Host...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 relative bg-gray-50">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="p-2 bg-white rounded-full shadow-sm text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Live Navigation</h1>
        <div className="w-9 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        </div>
      </header>

      <main className="flex-1 flex flex-col space-y-6 max-w-md mx-auto w-full">
        <div className="bg-blue-600 p-6 rounded-2xl shadow-md text-white">
          <p className="text-blue-200 text-sm font-medium mb-1">Following Session</p>
          <p className="text-2xl font-mono font-bold">{sessionId}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 mb-4">
            <Navigation2 className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Live Waypoints</h2>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm text-gray-700 overflow-x-auto border border-gray-100">
            {sessionData.live_waypoints && sessionData.live_waypoints.length > 0 ? (
              sessionData.live_waypoints.map((wp, index) => (
                <div key={index} className="py-1 border-b border-gray-200 last:border-0 flex justify-between">
                  <span className="text-gray-400 font-bold">P{index + 1}</span>
                  <span>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <span className="text-gray-400">No waypoints available.</span>
            )}
          </div>
        </div>

        {sessionData.delay_flag && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={20} />
            <div>
              <h3 className="text-red-800 font-semibold text-sm">Delay Alert</h3>
              <p className="text-red-600 text-sm">{sessionData.delay_message}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
