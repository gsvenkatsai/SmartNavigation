import { Link } from 'react-router-dom';
import { Navigation, Database, Activity, Bot } from 'lucide-react';
import { useState } from 'react';
import { seedDemoData } from '../utils/seeder';

export default function Home() {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDemoData();
    setIsSeeding(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-gray-950 text-gray-100">
      <header className="mb-10 text-center w-full">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20 mb-4">
          <span className="text-3xl font-bold">⬡</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2" style={{
          background: "linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          SmartNav
        </h1>
        <p className="text-gray-500 font-medium tracking-wide">Real-time Collaborative Navigation</p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full space-y-4 max-w-sm">
        <Link
          to="/host"
          className="w-full flex items-center justify-center space-x-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/20 transition duration-200 active:scale-95"
        >
          <Navigation size={20} />
          <span>Start as Host</span>
        </Link>
        
        <Link
          to="/dashboard"
          className="w-full flex items-center justify-center space-x-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-indigo-400 font-bold py-4 px-6 rounded-2xl shadow-sm transition duration-200 active:scale-95"
        >
          <Bot size={20} />
          <span>AI Intelligence Dashboard</span>
        </Link>
        
        <div className="w-full bg-gray-900/50 p-6 rounded-3xl shadow-sm border border-gray-800 text-center mt-8">
          <h2 className="text-lg font-semibold mb-2 flex items-center justify-center text-gray-300">
            <Database size={18} className="mr-2 text-indigo-500" />
            Developer Tools
          </h2>
          <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest font-bold">
            Populate Firestore with Day 0 dummy data
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 px-4 rounded-xl shadow-sm transition duration-200 disabled:opacity-50 active:scale-95 text-xs border border-gray-700"
          >
            {isSeeding ? 'Seeding Data...' : 'Seed Demo Data'}
          </button>
        </div>
      </main>
      
      <footer className="mt-12 text-center text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold">
        SmartNav Hackathon Project · 2026
      </footer>
    </div>
  );
}
