// VoiceAlert.jsx — Browser SpeechSynthesis wrapper for route warnings
// Real-time integration with Firestore sessions collection

import { useState, useEffect, useRef } from "react";
import { useFirestoreDoc } from "../hooks/useFirestore";

// Hardcoded Day 0 fallback warning
const DEFAULT_WARNING =
  "Warning. Community reports indicate heavy traffic. Use caution and follow the suggested route.";

export function VoiceAlert({ sessionId = "session-host-guest-101", autoSpeak = false }) {
  const [speaking, setSpeaking] = useState(false);
  const { data: sessionData } = useFirestoreDoc("sessions", sessionId);
  
  const text = sessionData?.ai_warning || DEFAULT_WARNING;
  const lastWarningRef = useRef("");

  const speak = (overrideText) => {
    if (window.speechSynthesis.speaking) return;
    const utterance = new SpeechSynthesisUtterance(overrideText || text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  // Trigger speak when ai_warning changes in Firestore
  useEffect(() => {
    if (sessionData?.ai_warning && sessionData.ai_warning !== lastWarningRef.current) {
      lastWarningRef.current = sessionData.ai_warning;
      if (autoSpeak) {
        speak(sessionData.ai_warning);
      }
    }
  }, [sessionData?.ai_warning, autoSpeak]);

  // Cleanup
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  return (
    <div
      className="absolute bottom-6 right-4 z-[1000] w-72"
      style={{ zIndex: 1000 }}
    >
      <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-amber-500/30">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-400 text-lg">⚠</span>
          <span className="text-amber-400 font-semibold text-sm tracking-wide">
            Community Alert
          </span>
          {speaking && (
            <span className="ml-auto flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-0.5 bg-amber-400 rounded-full animate-bounce"
                  style={{
                    height: "12px",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Warning text */}
        <p className="text-gray-300 text-xs leading-relaxed mb-3 line-clamp-3">
          {text}
        </p>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => speak()}
            disabled={speaking}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 disabled:cursor-not-allowed text-gray-950 font-semibold text-xs py-1.5 px-3 rounded-lg transition-all duration-200"
          >
            {speaking ? "Speaking..." : "▶ Play Warning"}
          </button>
          <button
            onClick={stop}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-1.5 px-3 rounded-lg transition-all duration-200"
          >
            ■ Stop
          </button>
        </div>
      </div>
    </div>
  );
}
