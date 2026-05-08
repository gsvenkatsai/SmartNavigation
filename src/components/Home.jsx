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
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-gray-50">
      <header className="mb-10 text-center w-full">
        <h1 className="text-4xl font-bold text-blue-600 mb-2">SmartNav</h1>
        <p className="text-gray-500">Real-time Collaborative Navigation</p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full space-y-4 max-w-sm">
        <Link
          to="/host"
          className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-xl shadow-md transition duration-200 active:scale-95"
        >
          <Navigation size={20} />
          <span>Start as Host</span>
        </Link>
        
        <Link
          to="/heatmap"
          className="w-full flex items-center justify-center space-x-3 bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 font-medium py-4 px-6 rounded-xl shadow-sm transition duration-200 active:scale-95 mt-4"
        >
          <Activity size={20} />
          <span>View Live Heatmap</span>
        </Link>
        
        <Link
          to="/dashboard"
          className="w-full flex items-center justify-center space-x-3 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 font-medium py-4 px-6 rounded-xl shadow-sm transition duration-200 active:scale-95 mt-4"
        >
          <Bot size={20} />
          <span>Test AI Panels</span>
        </Link>
        
        <div className="w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center mt-8">
          <h2 className="text-lg font-semibold mb-2 flex items-center justify-center text-gray-800">
            <Database size={18} className="mr-2 text-gray-500" />
            Database Tools
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Populate Firestore with Day 0 dummy data.
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-xl shadow-sm transition duration-200 disabled:opacity-50 active:scale-95 text-sm"
          >
            {isSeeding ? 'Seeding Data...' : 'Seed Demo Data'}
          </button>
        </div>
      </main>
      
      <footer className="mt-8 text-center text-xs text-gray-400">
        SmartNav Hackathon Project
      </footer>
    </div>
  );
}
