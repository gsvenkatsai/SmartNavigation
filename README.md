# SmartNav - AI-Powered Community Navigation

This project is a smart, context-aware traffic and routing system that leverages Vite, React, Firebase, Gemini AI, and Leaflet. It combines an interactive mapping core with an AI intelligence layer to provide community-powered navigation.

## 🚀 Features Implemented
- **AI Intelligence Layer**: Powered by Google Gemini.
  - `reporterAgent.js`: Processes initial user reports.
  - `routeIntelligenceAgent.js`: Analyzes routes for traffic, hazards, and alternative suggestions.
  - `whyAvoidAgent.js`: Generates user-friendly explanations for why certain routes should be avoided.
- **Interactive Map**: React Leaflet map with OpenStreetMap tiles, centered on Bangalore.
- **Routing Engine**: Integration with OpenRouteService (ORS) API for accurate driving routes.
- **Draggable Routes**: Users can click to add waypoints and drag markers to dynamically reroute.
- **Voice Alerts**: Web SpeechSynthesis API integration for playing AI-generated warnings.
- **Firestore Integration**:
  - Heatmap overlay for visualizing preferred and avoided segments.
  - Real-time updates for community alerts.

## 🛠 Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS
- **Mapping**: Leaflet, React-Leaflet, OpenRouteService API
- **AI**: Google Gemini API
- **Backend/Database**: Firebase Firestore

## Project Structure
- `src/agents/`: AI Agents powering the intelligence backend.
- `src/components/`: UI components (MapView, RoutingEngine, VoiceAlert, etc.).
- `src/hooks/`: Custom hooks for data fetching and state management.
- `src/services/`: External service integrations (Weather, etc.).
- `src/config/`: Configuration files (Firebase, Gemini).

## ⚙️ Environment Variables
Ensure you have a `.env` file in the root directory:
```env
VITE_GEMINI_KEY=your_gemini_api_key
VITE_OPENWEATHER_KEY=your_openweather_api_key
VITE_ORS_API_KEY=your_openrouteservice_api_key
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🐳 Docker Setup
1. **Build the Docker image:**
   ```bash
   docker build -t smartnav-app .
   ```
2. **Run the Docker container:**
   ```bash
   docker run -p 5173:5173 --env-file .env smartnav-app
   ```
The application will be accessible at `http://localhost:5173`.

## Local Installation
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the development server:**
   ```bash
   npm run dev
   ```
