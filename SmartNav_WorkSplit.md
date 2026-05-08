# SmartNav Technical Specifications & Work-Split

## [cite_start]1. Project Overview [cite: 1, 2]

- [cite_start]**Architecture**: 4-layer integrated build (Maps, Firebase, AI, Coordination). [cite: 2, 78]
- [cite_start]**Core Stack**: React + Vite + Tailwind, Leaflet, and Firebase. [cite: 5, 6, 22]

---

## [cite_start]2. Layer 1: Maps & Routing Core (Member 1) [cite: 3]

[cite_start]**Goal**: Fully functional map, routing, and drag-to-reroute. [cite: 4]

- [cite_start]**Map Setup**: React Leaflet map with OpenStreetMap tiles, centered on Bangalore. [cite: 6]
- [cite_start]**Routing API**: OpenRoute Service API to generate routes between two points. [cite: 7]
- **Draggable Logic**:
  - [cite_start]Draggable route using Leaflet Routing Machine. [cite: 9]
  - [cite_start]**On drag**: Recalculate route and extract updated waypoints `{lat, lng}`. [cite: 10]
  - [cite_start]**On drag**: Identify affected `segment_ids` and write `prefer_count++` to Firestore. [cite: 11]
- [cite_start]**Accessibility**: SpeechSynthesis API to speak AI warning text from sessions doc. [cite: 13, 15]

---

## [cite_start]3. Layer 2: Firebase, Real-time & UI (Member 2) [cite: 21]

[cite_start]**Goal**: All collaboration, realtime sync, and UI panels. [cite: 21]

- **Real-time Sync**:
  - [cite_start]**Session Sync**: `onSnapshot` on sessions doc pushes `live_waypoints` to guest map. [cite: 26]
  - [cite_start]**Heatmap Sync**: `onSnapshot` on segments re-renders heatmap on count changes. [cite: 27]
- **UI & Features**:
  - [cite_start]**Heatmap Overlay**: Green (preferred), red (avoided), pulse animation for recent reports. [cite: 32]
  - [cite_start]**WhatsApp Integration**: Share session via `wa.me/?text=Join+my+SmartNav+session+{session_id}`. [cite: 25]
  - [cite_start]**Panels**: Report modal, Validation log, and "Why locals avoid this" panel. [cite: 29, 30, 36]

---

## [cite_start]4. Layer 3: AI & Intelligence Layer (Member 3) [cite: 47]

[cite_start]**Goal**: AI analysis and structured output to Firestore. [cite: 47]

- [cite_start]**Reporter Agent**: Categorizes reports by type, severity, and location. [cite: 50, 51]
- [cite_start]**Verification Agent**: Assigns `verification_status` (verified, low_confidence, suspicious). [cite: 53, 54]
- [cite_start]**Route Intelligence**: Generates contextual AI warning strings. [cite: 57, 58]
- [cite_start]**Predictive Risk**: Includes rain/weather data in AI risk summaries. [cite: 62]

---

## [cite_start]5. Firestore Data Contracts (LOCKED) [cite: 96, 97]

[cite_start]_Do not rename these fields during integration._ [cite: 98]

### [cite_start]`segments` collection [cite: 99]

[cite_start]`{ segment_id, prefer_count, avoid_count, confidence, last_updated }` [cite: 101]

### [cite_start]`sessions` collection [cite: 102]

[cite_start]`{ session_id, guest_route, live_waypoints, route_geometry, status, ai_warning, delay_flag, delay_message, why_avoid_text }` [cite: 104]

### [cite_start]`reports` collection [cite: 105]

[cite_start]`{ segment_id, report_text, ai_category, ai_severity, verification_status, created_at }` [cite: 107]

---

## [cite_start]6. Integration Priorities [cite: 115]

1. [cite_start]**MUST**: Host drags route -> Guest route updates instantly. [cite: 123, 124]
2. [cite_start]**SECOND**: Heatmap visibly changes on new reports. [cite: 125, 126]
3. [cite_start]**THIRD**: AI validates and structures reports. [cite: 127, 128]
