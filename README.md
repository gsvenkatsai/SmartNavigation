<div align="center">

<img src="assets/logo.png" alt="SmartNav Logo" width="120" height="120" />

# SmartNav
### AI-Powered Community Navigation

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **SmartNav** is a real-time, community-driven navigation platform for Bangalore.  
> It combines interactive maps, live route sharing, and a multi-agent AI pipeline to surface hyper-local traffic intelligence — flooding alerts, congestion hotspots, and road hazards — before they affect your drive.

[Features](#-features) · [Architecture](#-architecture) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Screenshots](#-screenshots) · [Data Model](#-firestore-data-model) · [Environment Variables](#-environment-variables) · [Docker](#-docker-setup) · [Contributing](#-contributing)

</div>

---

## 📸 Screenshots

<div align="center">

### Home Screen
<img src="assets/screenshot-home.png" alt="SmartNav Home" width="800" />

### Interactive Map View
<img src="assets/screenshot-map.png" alt="Map View with Route" width="800" />

### AI Dashboard — Report & Validation Log
<img src="assets/screenshot-dashboard.png" alt="AI Dashboard" width="800" />

### Segment Heatmap Overlay
<img src="assets/screenshot-heatmap.png" alt="Heatmap" width="800" />

### Host & Guest Session Sync
<img src="assets/screenshot-session.png" alt="Host Guest Session" width="800" />

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Interactive Map** | React-Leaflet map centered on Bangalore with OpenStreetMap tiles |
| 🔀 **Draggable Routes** | Click to place waypoints; drag to reroute — Firestore is updated in real-time |
| 🤖 **Multi-Agent AI** | 5 specialized AI agents: Reporter, Verification, Route Intelligence, WhyAvoid, Delay |
| 🔴 **Segment Heatmap** | Green = preferred, Red = avoided, pulsing = recently reported |
| 👥 **Host / Guest Sessions** | Hosts share a session link; guests see live route updates via Firestore `onSnapshot` |
| 📣 **Voice Alerts** | Web SpeechSynthesis API speaks AI-generated traffic warnings aloud |
| 💬 **Community Reports** | Users submit free-text reports; AI categorizes, verifies, and scores them |
| 🌦️ **Weather Integration** | OpenWeather data feeds into AI risk summaries (flooding, rain delays) |
| 📲 **WhatsApp Share** | One-tap to share a session invite or delay notification via WhatsApp |
| 📦 **Docker Ready** | Single `docker run` to spin up the full app with `.env` injection |

---

## 🏗 Architecture

SmartNav is built on **4 integrated layers**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │   Home   │  │ HostView │  │  GuestView   │  │AIDashboard│  │
│  └──────────┘  └──────────┘  └──────────────┘  └───────────┘  │
│                          │                                       │
│               ┌──────────▼──────────┐                           │
│               │       MapView        │                           │
│               │  ┌───────────────┐  │                           │
│               │  │DraggableRoute │  │                           │
│               │  │SegmentHeatmap │  │                           │
│               │  │  VoiceAlert   │  │                           │
│               │  └───────────────┘  │                           │
│               └─────────────────────┘                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
│   Layer 1   │   │   Layer 2    │   │    Layer 3        │
│  Maps &     │   │  Firebase &  │   │  AI Agent Pipeline│
│  Routing    │   │  Real-time   │   │                  │
│             │   │              │   │ ┌──────────────┐ │
│ ORS API     │   │ Firestore    │   │ │ReporterAgent │ │
│ Leaflet     │   │ onSnapshot   │   │ └──────┬───────┘ │
│ Geocoding   │   │ Sessions     │   │        ▼         │
│ Isochrones  │   │ Segments     │   │ ┌──────────────┐ │
│ SpeechSynth │   │ Reports      │   │ │Verification  │ │
│             │   │              │   │ │   Agent      │ │
└─────────────┘   └──────────────┘   │ └──────┬───────┘ │
                                     │        ▼         │
                                     │ ┌──────────────┐ │
                                     │ │ Confidence   │ │
                                     │ │   Agent      │ │
                                     │ └──────┬───────┘ │
                                     │        ▼         │
                                     │ ┌──────────────┐ │
                                     │ │RouteIntel    │ │
                                     │ │   Agent      │ │
                                     │ └──────┬───────┘ │
                                     │        ▼         │
                                     │ ┌──────────────┐ │
                                     │ │  Delay Agent │ │
                                     │ │ WhyAvoid Agt │ │
                                     │ └──────────────┘ │
                                     └──────────────────┘
                                              │
                                     ┌────────▼────────┐
                                     │  Layer 4         │
                                     │  External APIs   │
                                     │                  │
                                     │  Groq API   │
                                     │  OpenWeather     │
                                     │  OpenRouteService│
                                     └──────────────────┘
```

### AI Agent Pipeline — Data Flow

```
User submits report (free text)
         │
         ▼
  [ Reporter Agent ]
  - Categorizes: type, severity, location
  - Writes: ai_category, ai_severity → Firestore reports/{id}
         │
         ▼
  [ Verification Agent ]
  - Cross-checks: recent similar reports + live weather
  - Assigns: verification_status (verified | low_confidence | suspicious)
         │
         ▼
  [ Confidence Agent ]
  - Aggregates all reports for a segment
  - Scores: confidence 0.50 → 0.75 → 0.95 based on report volume
  - Updates: segments/{segment_id}.confidence
         │
         ▼
  [ Route Intelligence Agent ]
  - Reads high-avoid segments + weather + hour of day
  - Generates: contextual 20-word warning string
  - Writes: sessions/{id}.ai_warning  →  Voice Alert speaks it
         │
         ▼
  [ Delay Agent ]
  - Detects if avoid_count ≥ 8 (severe congestion threshold)
  - Generates: WhatsApp-style delay message
  - Writes: sessions/{id}.delay_flag + delay_message
         │
         ▼
  [ WhyAvoid Agent ]
  - Summarizes last 5 community reports for a segment
  - Writes: sessions/{id}.why_avoid_text  →  UI panel
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **Routing (App)** | React Router DOM 7 |
| **Mapping** | Leaflet 1.9 + React-Leaflet 5 |
| **Routing API** | OpenRouteService (Directions, Isochrones, Matrix, Geocoding) |
| **AI / LLM** | Groq API |
| **Database** | Firebase Firestore (real-time `onSnapshot`) |
| **Auth** | Firebase Auth |
| **Weather** | OpenWeather API |
| **Voice** | Web SpeechSynthesis API (browser-native) |
| **Icons** | Lucide React |
| **Containerization** | Docker |

---

## 📁 Project Structure

```
SmartNavigation/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── agents/                    # AI Agent Pipeline
│   │   ├── index.js               # Agent exports
│   │   ├── reporterAgent.js       # Categorizes community reports
│   │   ├── verificationAgent.js   # Verifies report credibility
│   │   ├── confidenceAgent.js     # Scores segment confidence
│   │   ├── routeIntelligenceAgent.js  # Generates AI route warnings
│   │   ├── delayAgent.js          # Detects & notifies delays
│   │   └── whyAvoidAgent.js       # Summarizes avoidance reasons
│   ├── components/
│   │   ├── Home.jsx               # Landing / entry page
│   │   ├── HostView.jsx           # Host creates & shares session
│   │   ├── GuestView.jsx          # Guest follows host's route live
│   │   ├── MapView.jsx            # Core map with search & routing
│   │   ├── DraggableRoute.jsx     # Drag-to-reroute logic
│   │   ├── SegmentHeatmap.jsx     # Green/red heatmap overlay
│   │   ├── VoiceAlert.jsx         # SpeechSynthesis alert
│   │   ├── AIDashboard.jsx        # Report modal + validation log
│   │   └── RoutingEngine.jsx      # ORS route orchestration
│   ├── config/
│   │   └── groq.js                # Groq model config
│   ├── hooks/
│   │   └── useFirestore.js        # Firestore helpers & custom hooks
│   ├── services/
│   │   ├── firebase.js            # Firebase init + schema contracts
│   │   ├── orsService.js          # ORS API wrapper (Directions, Isochrones, etc.)
│   │   └── weatherService.js      # OpenWeather integration
│   ├── utils/
│   │   ├── aiUtils.js             # safeGenerate wrapper
│   │   ├── routeHelpers.js        # Waypoint & segment utilities
│   │   └── seeder.js              # Firestore seed data
│   ├── App.jsx                    # Root router + agent bootstrap
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── assets/                        # README screenshots (see below)
├── Dockerfile
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── README.md
```

---

## 🔥 Firestore Data Model

### `segments` collection

Tracks community preference/avoidance per road segment.

```json
{
  "segment_id": "sony-signal-02",
  "prefer_count": 12,
  "avoid_count": 7,
  "confidence": 0.75,
  "last_updated": "2025-05-09T10:30:00Z"
}
```

### `sessions` collection

One document per navigation session shared between a host and guest.

```json
{
  "session_id": "session-host-guest-101",
  "guest_route": { "start": {}, "end": {} },
  "live_waypoints": [ { "lat": 12.97, "lng": 77.59 } ],
  "route_geometry": "...",
  "status": "active",
  "ai_warning": "Flooding risk near Silk Board — consider MG Road.",
  "delay_flag": true,
  "delay_message": "Stuck near Silk Board, running ~15 mins late!",
  "why_avoid_text": "Waterlogging blocks left lane after rain."
}
```

### `reports` collection

Stores raw community reports and their AI-processed metadata.

```json
{
  "segment_id": "sony-signal-02",
  "report_text": "There is massive flooding near the signal",
  "ai_category": "flooding",
  "ai_severity": "high",
  "verification_status": "verified",
  "created_at": "2025-05-09T09:45:00Z"
}
```

> ⚠️ **Schema Contract** — Do not rename any of these fields. The agent pipeline and UI components depend on exact field names.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Groq API AI
VITE_GROQ_API_KEY=your_groq_api_key

# OpenWeather
VITE_OPENWEATHER_KEY=your_openweather_api_key

# OpenRouteService
VITE_ORS_API_KEY=your_openrouteservice_api_key

# Firebase
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- A Firebase project with Firestore enabled
- API keys for Groq, OpenRouteService, and OpenWeather

### Local Installation

```bash
# 1. Clone the repository
git clone https://github.com/gsvenkatsai/SmartNavigation.git
cd SmartNavigation
git checkout dev

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your keys

# 4. Start the development server
npm run dev
```

App will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🐳 Docker Setup

```bash
# Build the image
docker build -t smartnav-app .

# Run with your .env file
docker run -p 5173:5173 --env-file .env smartnav-app
```

App will be available at `http://localhost:5173`

---

## 🗺 App Routes

| Path | Component | Description |
|---|---|---|
| `/` | `Home` | Landing page — create or join a session |
| `/host` | `HostView` | Host creates a session, draws route |
| `/join/:sessionId` | `GuestView` | Guest follows host's live route |
| `/dashboard` | `AIDashboard` | Report submission + AI validation log |
| `/map` | `MapView` | Standalone map for testing |

---

## 📸 Adding Screenshots

Place screenshots in the `assets/` folder at the repo root with these exact names:

| File | What to capture |
|---|---|
| `assets/logo.png` | App logo / icon |
| `assets/screenshot-home.png` | Home / landing screen |
| `assets/screenshot-map.png` | Map view with a route plotted |
| `assets/screenshot-dashboard.png` | AI Dashboard with reports & validation log |
| `assets/screenshot-heatmap.png` | Map with heatmap overlay visible |
| `assets/screenshot-session.png` | Host view with session sharing panel |

> Recommended: 1440×900 resolution, PNG format.

---

## 🤝 Contributing

This project follows a **4-layer, 3-member** work-split:

| Member | Layer | Ownership |
|---|---|---|
| Member 1 | Maps & Routing Core | `MapView`, `DraggableRoute`, `orsService`, `VoiceAlert` |
| Member 2 | Firebase & Real-time UI | `HostView`, `GuestView`, `SegmentHeatmap`, `useFirestore` |
| Member 3 | AI Intelligence Layer | All agents in `src/agents/`, `weatherService`, `aiUtils` |

### Rules

1. Do **not** rename locked Firestore field names (see Data Model above).
2. Always pull from `dev` branch before pushing.
3. Integration priority order: Host→Guest sync → Heatmap updates → AI validation.

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature
# ... make changes ...
git push origin feature/your-feature
# Open a PR → dev
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ for Bangalore's roads  
**SmartNav** — *Community-Powered Navigation*

</div>
