import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, reportsCollection } from '../services/firebase';
import { doc, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ArrowLeft, AlertTriangle, MessageSquare, CheckCircle, Clock, ShieldAlert, Send, Info, X } from 'lucide-react';

export default function AIDashboard() {
  const [reports, setReports] = useState([]);
  const [sessionData, setSessionData] = useState(null);
  
  // State for Report Modal (Write)
  const [reportInput, setReportInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Panel Toggles
  const [showWhyAvoid, setShowWhyAvoid] = useState(false);
  const [showDelayPopup, setShowDelayPopup] = useState(true); // Control dismissal

  useEffect(() => {
    // 1. Validation Log Listener (Reads Reports)
    // We order by created_at desc if possible. If some are strings and some are timestamps, 
    // ordering might be slightly mixed, but we'll try ordering by created_at desc.
    const reportsQuery = query(reportsCollection, orderBy('created_at', 'desc'));
    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(data);
    }, (err) => console.error("Reports listener error:", err));

    // 2. Session Context Listener (Reads Demo Session)
    const sessionRef = doc(db, 'sessions', 'session-host-guest-101');
    const unsubSession = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSessionData(data);
        // If delay flag flips to true, ensure popup shows again
        if (data.delay_flag) {
          setShowDelayPopup(true);
        }
      }
    }, (err) => console.error("Session listener error:", err));

    return () => {
      unsubReports();
      unsubSession();
    };
  }, []);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportInput.trim()) return;

    setIsSubmitting(true);
    try {
      // Contract: report_text, segment_id, created_at
      await addDoc(reportsCollection, {
        segment_id: "domlur_1",
        report_text: reportInput.trim(),
        created_at: serverTimestamp()
      });
      setReportInput('');
    } catch (err) {
      console.error("Error submitting report:", err);
      alert("Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const delayWhatsAppLink = sessionData 
    ? `https://wa.me/?text=${encodeURIComponent(sessionData.delay_message)}`
    : '#';

  return (
    <div className="flex flex-col min-h-screen relative bg-gray-50 pb-20">
      <header className="p-6 pb-2 flex items-center justify-between">
        <Link to="/" className="p-2 bg-white rounded-full shadow-sm text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800">AI Dashboard</h1>
        <div className="w-9"></div>
      </header>

      <main className="flex-1 px-6 space-y-6 max-w-md mx-auto w-full">
        
        {/* WARNING CARD OVERLAY */}
        {sessionData && sessionData.ai_warning && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl shadow-sm flex items-start space-x-3 mt-4">
            <AlertTriangle className="text-orange-500 mt-0.5 shrink-0" size={24} />
            <div>
              <h3 className="text-orange-800 font-bold text-sm">AI Warning</h3>
              <p className="text-orange-700 text-sm">{sessionData.ai_warning}</p>
            </div>
          </div>
        )}

        {/* 'WHY LOCALS AVOID THIS' PANEL */}
        {sessionData && sessionData.why_avoid_text && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-gray-50">
              <div className="flex items-center space-x-2 text-indigo-600 font-semibold">
                <ShieldAlert size={20} />
                <span>Segment Analysis</span>
              </div>
              <button 
                onClick={() => setShowWhyAvoid(!showWhyAvoid)}
                className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 active:scale-95 transition"
              >
                Simulate Segment Click
              </button>
            </div>
            {showWhyAvoid && (
              <div className="p-4 bg-indigo-50/30 text-sm text-gray-700 animate-in slide-in-from-top-2">
                <p className="font-medium text-indigo-900 mb-1">Why locals avoid this:</p>
                <p>{sessionData.why_avoid_text}</p>
              </div>
            )}
          </div>
        )}

        {/* REPORT MODAL (WRITE) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 mb-4">
            <MessageSquare className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Submit Report</h2>
          </div>
          <form onSubmit={handleReportSubmit} className="flex flex-col space-y-3">
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="3"
              placeholder="What's happening on the road?"
              value={reportInput}
              onChange={(e) => setReportInput(e.target.value)}
            ></textarea>
            <button
              type="submit"
              disabled={isSubmitting || !reportInput.trim()}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition active:scale-95"
            >
              <span>{isSubmitting ? 'Submitting...' : 'Send Report'}</span>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* VALIDATION LOG (READ) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="text-green-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Validation Log</h2>
          </div>
          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No reports yet.</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="border-l-2 border-blue-400 pl-3 py-1">
                  <p className="text-sm text-gray-800 font-medium mb-1">"{report.report_text}"</p>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Render AI Fields conditionally, as they might be missing on new reports */}
                    {report.ai_category ? (
                      <span className="text-[10px] uppercase font-bold tracking-wide bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
                        {report.ai_category}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wide bg-gray-100 text-gray-400 px-2 py-1 rounded-md flex items-center">
                        <Clock size={10} className="mr-1" /> Pending AI
                      </span>
                    )}

                    {report.ai_severity && (
                      <span className={`text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-md ${
                        report.ai_severity === 'high' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        Severity: {report.ai_severity}
                      </span>
                    )}

                    {report.verification_status && (
                      <span className={`text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-md flex items-center ${
                        report.verification_status === 'verified' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {report.verification_status === 'verified' && <CheckCircle size={10} className="mr-1" />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="bg-red-500 p-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2 font-bold">
                <AlertTriangle size={20} />
                <span>Delay Detected</span>
              </div>
              <button onClick={() => setShowDelayPopup(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-800 font-medium mb-6">{sessionData.delay_message}</p>
              <a
                href={delayWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl transition active:scale-95"
              >
                <span>Notify Contact via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
