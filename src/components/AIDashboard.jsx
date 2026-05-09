import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db, reportsCollection } from '../services/firebase';
import { doc, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ArrowLeft, AlertTriangle, MessageSquare, CheckCircle, Clock, ShieldAlert, Send, X, Bot, Zap } from 'lucide-react';
import { runWhyAvoidAgent } from '../agents';

export default function AIDashboard() {
  const { sessionId: paramSessionId } = useParams();
  const sessionId = paramSessionId || 'session-host-guest-101';

  const [reports, setReports] = useState([]);
  const [sessionData, setSessionData] = useState(null);
  
  // State for Report Modal (Write)
  const [reportInput, setReportInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Panel Toggles
  const [showWhyAvoid, setShowWhyAvoid] = useState(false);
  const [showDelayPopup, setShowDelayPopup] = useState(true);

  useEffect(() => {
    // 1. Validation Log Listener (Reads Reports)
    const reportsQuery = query(reportsCollection, orderBy('created_at', 'desc'));
    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(data);
    }, (err) => console.error("Reports listener error:", err));

    // 2. Session Context Listener
    const sessionRef = doc(db, 'sessions', sessionId);
    const unsubSession = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSessionData(data);
        if (data.delay_flag) {
          setShowDelayPopup(true);
        }
      }
    }, (err) => console.error("Session listener error:", err));

    return () => {
      unsubReports();
      unsubSession();
    };
  }, [sessionId]);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportInput.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(reportsCollection, {
        segment_id: "sony-signal-02",
        report_text: reportInput.trim(),
        created_at: serverTimestamp(),
        ai_category: "", // Triggers AI Agent
        ai_severity: "",
        verification_status: "pending"
      });
      setReportInput('');
    } catch (err) {
      console.error("Error submitting report:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const delayWhatsAppLink = sessionData 
    ? `https://wa.me/?text=${encodeURIComponent(sessionData.delay_message)}`
    : '#';

  return (
    <div className="flex flex-col min-h-screen relative bg-gray-950 text-gray-100 pb-20 overflow-x-hidden">
      <header className="p-6 pb-2 flex items-center justify-between border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <Link to={paramSessionId ? `/join/${paramSessionId}` : "/"} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-400">AI Intelligence</h1>
          <p className="text-[10px] text-gray-500 font-mono">Real-time Agent Monitoring</p>
        </div>
        <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20">
          <Bot size={20} className="text-indigo-400" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 max-w-md mx-auto w-full">
        
        {/* WARNING CARD OVERLAY */}
        {sessionData && sessionData.ai_warning && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <div>
              <h3 className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">Live AI Warning</h3>
              <p className="text-gray-200 text-sm leading-relaxed">{sessionData.ai_warning}</p>
            </div>
          </div>
        )}

        {/* 'WHY LOCALS AVOID THIS' PANEL */}
        {sessionData && sessionData.why_avoid_text && (
          <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert size={16} />
                <span>Segment Analysis</span>
              </div>
              <button 
                onClick={async () => {
                  if (!showWhyAvoid) {
                    await runWhyAvoidAgent('sony-signal-02', sessionId);
                  }
                  setShowWhyAvoid(!showWhyAvoid);
                }}
                className="text-[10px] font-bold text-indigo-400 bg-indigo-400/10 px-3 py-1.5 rounded-full hover:bg-indigo-400/20 transition active:scale-95"
              >
                {showWhyAvoid ? "Hide" : "Run AI Analysis"}
              </button>
            </div>
            {showWhyAvoid && (
              <div className="p-4 bg-indigo-500/5 text-sm text-gray-300 animate-in slide-in-from-top-2">
                <p className="font-bold text-indigo-300 mb-1 text-xs">Why locals avoid this:</p>
                <p className="leading-relaxed text-indigo-100/80 italic">"{sessionData.why_avoid_text}"</p>
              </div>
            )}
          </div>
        )}

        {/* REPORT MODAL (WRITE) */}
        <div className="bg-gray-900 p-5 rounded-2xl shadow-xl border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
              <MessageSquare className="text-blue-400" size={16} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">Submit Report</h2>
          </div>
          <form onSubmit={handleReportSubmit} className="flex flex-col space-y-3">
            <textarea
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              rows="3"
              placeholder="What's happening on the road? (e.g. Flooding at Sony Signal)"
              value={reportInput}
              onChange={(e) => setReportInput(e.target.value)}
            ></textarea>
            <button
              type="submit"
              disabled={isSubmitting || !reportInput.trim()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-800 text-white py-3 rounded-xl font-bold transition active:scale-95 text-sm shadow-lg shadow-blue-500/10"
            >
              <span>{isSubmitting ? 'Processing...' : 'Broadcast Report'}</span>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* VALIDATION LOG (READ) */}
        <div className="bg-gray-900 p-5 rounded-2xl shadow-xl border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center border border-green-500/20">
                <Zap className="text-green-400" size={16} />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">Validation Log</h2>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Real-time Feed</span>
          </div>
          
          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8 italic">Waiting for reports...</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="relative pl-4 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-indigo-500/30">
                  <p className="text-sm text-gray-300 font-medium mb-2 leading-relaxed">"{report.report_text}"</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {report.ai_category ? (
                      <span className="text-[9px] uppercase font-black tracking-widest bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/30">
                        {report.ai_category}
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold tracking-widest bg-gray-800 text-gray-500 px-2 py-1 rounded-md flex items-center gap-1">
                        <Clock size={10} className="animate-spin" /> Analyzing
                      </span>
                    )}

                    {report.ai_severity && (
                      <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded-md border ${
                        report.ai_severity === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {report.ai_severity}
                      </span>
                    )}

                    {report.verification_status && (
                      <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded-md flex items-center gap-1 border ${
                        report.verification_status === 'verified' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'
                      }`}>
                        {report.verification_status === 'verified' && <CheckCircle size={10} />}
                        {report.verification_status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* PROACTIVE DELAY POPUP (MODAL) */}
      {sessionData && sessionData.delay_flag && showDelayPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-500/30 animate-in zoom-in-95 duration-300">
            <div className="bg-red-600 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 font-black uppercase tracking-tighter text-sm">
                <AlertTriangle size={18} />
                <span>Delay Detected</span>
              </div>
              <button onClick={() => setShowDelayPopup(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 text-center">
              <p className="text-gray-100 text-sm font-medium mb-8 leading-relaxed italic">"{sessionData.delay_message}"</p>
              <a
                href={delayWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-2xl transition shadow-lg shadow-green-500/20 active:scale-95"
              >
                <span>Notify Host via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
