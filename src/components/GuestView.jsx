import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFirestoreDoc } from '../hooks/useFirestore';
import { Loader2, ArrowLeft, Navigation2, AlertTriangle, Activity } from 'lucide-react';
import { MapView } from './MapView';

export default function GuestView() {
  const { sessionId } = useParams();
  const { data: sessionData, loading, error } = useFirestoreDoc("sessions", sessionId);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gray-950">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-gray-100 mb-2">Session Error</h2>
        <p className="text-gray-500 mb-6">Failed to connect to real-time session or session has ended.</p>
        <Link to="/" className="text-indigo-400 font-medium hover:underline flex items-center justify-center">
          <ArrowLeft size={16} className="mr-1" /> Return Home
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-gray-400 font-medium">Connecting to Host...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gray-950">
        <AlertTriangle className="text-amber-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-gray-100 mb-2">Not Found</h2>
        <p className="text-gray-500 mb-6">Session {sessionId} does not exist.</p>
        <Link to="/" className="text-indigo-400 font-medium hover:underline flex items-center justify-center">
          <ArrowLeft size={16} className="mr-1" /> Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Guest Sub-header — mobile responsive */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-white font-bold text-sm">Guest Mode</h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-[10px] font-mono tracking-widest">{sessionId}</span>
              <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded text-[8px] border border-green-500/20 text-green-400 uppercase font-bold">
                <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                Live
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sessionData.delay_flag && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-2 sm:px-3 py-1 animate-bounce">
              <AlertTriangle className="text-red-500" size={12} />
              <span className="text-red-400 text-[10px] font-bold uppercase tracking-tighter hidden sm:inline">Delay Alert</span>
            </div>
          )}
          <Link to="/dashboard" className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/30 border border-indigo-500/20 rounded-full text-indigo-400 transition-colors">
            <Activity size={18} />
          </Link>
        </div>
      </div>

      {/* Map Content (Read-Only) */}
      <div className="flex-1 relative">
        <MapView sessionId={sessionId} isHost={false} />
      </div>

      {/* Persistent Delay Message if applicable */}
      {sessionData.delay_flag && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="bg-red-900/90 backdrop-blur-md border border-red-500/30 p-4 rounded-2xl shadow-2xl flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-100 text-xs font-medium leading-relaxed">
                {sessionData.delay_message || "A delay has been detected on this route."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
