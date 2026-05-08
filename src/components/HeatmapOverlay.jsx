import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Loader2, ArrowLeft, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HeatmapOverlay() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const segmentsRef = collection(db, 'segments');
    
    const unsubscribe = onSnapshot(segmentsRef, (snapshot) => {
      const segmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSegments(segmentsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching segments:", err);
      setError("Failed to load real-time heatmap data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-gray-500">Loading Heatmap...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <p className="text-red-500 mb-4">{error}</p>
        <Link to="/" className="text-blue-600 font-medium hover:underline flex items-center justify-center">
          <ArrowLeft size={16} className="mr-1" /> Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 relative bg-gray-50">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="p-2 bg-white rounded-full shadow-sm text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800 flex items-center">
          <Activity size={20} className="mr-2 text-blue-500" />
          Live Heatmap
        </h1>
        <div className="w-9 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full">
        {segments.length === 0 ? (
          <p className="text-center text-gray-500 mt-10">No segments found.</p>
        ) : (
          <div className="grid gap-4">
            {segments.map(segment => {
              // Determine visual color state
              let bgColor = "bg-gray-100 border-gray-300";
              let textColor = "text-gray-800";
              let statusText = "Neutral";

              if (segment.prefer_count > segment.avoid_count) {
                bgColor = "bg-green-100 border-green-300";
                textColor = "text-green-800";
                statusText = "Preferred";
              } else if (segment.avoid_count > segment.prefer_count) {
                bgColor = "bg-red-100 border-red-300";
                textColor = "text-red-800";
                statusText = "Avoided";
              }

              // Determine pulse animation state (updated within last 5 minutes)
              const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
              const lastUpdatedDate = new Date(segment.last_updated);
              const isRecent = lastUpdatedDate > fiveMinsAgo;
              
              const pulseClass = isRecent ? "animate-pulse" : "";

              return (
                <div 
                  key={segment.id} 
                  className={`p-5 rounded-2xl border shadow-sm ${bgColor} ${pulseClass} transition-colors duration-300`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold text-lg ${textColor}`}>
                      {segment.segment_id}
                    </h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full bg-white/60 ${textColor} border ${bgColor.split(' ')[1]}`}>
                      {statusText}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mt-4">
                    <div className="flex flex-col bg-white/50 p-2 rounded-lg text-center">
                      <span className="text-xs text-gray-500 font-medium">Prefer</span>
                      <span className="font-bold text-green-600">{segment.prefer_count}</span>
                    </div>
                    <div className="flex flex-col bg-white/50 p-2 rounded-lg text-center">
                      <span className="text-xs text-gray-500 font-medium">Avoid</span>
                      <span className="font-bold text-red-600">{segment.avoid_count}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 text-xs opacity-80">
                    <span className={textColor}>Confidence: {(segment.confidence * 100).toFixed(0)}%</span>
                    <span className={textColor}>{isRecent ? 'Just updated!' : 'Older report'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
