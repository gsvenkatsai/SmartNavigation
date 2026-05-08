import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import HostView from './components/HostView';
import GuestView from './components/GuestView';
import HeatmapOverlay from './components/HeatmapOverlay';
import AIDashboard from './components/AIDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<HostView />} />
        <Route path="/join/:sessionId" element={<GuestView />} />
        <Route path="/heatmap" element={<HeatmapOverlay />} />
        <Route path="/dashboard" element={<AIDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
