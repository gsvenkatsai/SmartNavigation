# SmartNav Dev Log: Infrastructure & Intelligence Setup
**Date:** May 8, 2026
**Lead:** Sethu Venkata Sai (Member 2)
**Status:** Layer 2 (Backend & Real-time) - COMPLETE

## 1. Infrastructure Architecture
- **Cloud Provider:** Firebase (Google Cloud Platform)
- **Region:** `asia-south1` (Mumbai) chosen for optimized latency in real-time coordination.
- **Service Tier:** Spark (Free tier) with standard Firestore instance.
- **Environment Management:** Implemented `.env.local` architecture for VITE-prefixed SDK keys, ensuring secure client-side injection.

## 2. Database Design & Implementation
Successfully initialized **Cloud Firestore** in "Test Mode" to facilitate rapid Day 0 prototyping.
- **Collection: `segments`**
  - Stores location-based status (e.g., Sony Signal, Domlur).
  - Contains `avoid_count` and `heatmap_color` logic.
- **Collection: `sessions`**
  - Powers the Host-Guest synchronization.
  - Implements real-time `onSnapshot` listeners for coordinate updates.
- **Collection: `reports`**
  - Stores AI-generated incident reports (e.g., Category: Flooding, Severity: High).

## 3. Key Milestones & Validations
- **Cloud Seeding:** Successfully executed `seeder.js` via the browser-based Database Tools to populate the cloud instance with initial datasets.
- **Real-Time Sync Protocol:** Verified sub-second latency for coordinate transmission between separate Host and Guest browser instances.
- **AI Alert Logic:** Confirmed that High-Severity cloud reports successfully trigger the **"Delay Detected"** modal in the React UI.
- **API Integrations:** Validated the WhatsApp Business API link for automated delay notifications.

## 4. Technical Hurdles & Resolutions
- **Issue:** Environment variables not loading into Vite dev server.
- **Resolution:** Full server restart and hard browser cache refresh; confirmed that Vite only reads `.env` files on cold boot.
- **Issue:** Permission denied on Firestore write.
- **Resolution:** Verified and updated Firestore Security Rules to `allow read, write: if true;` for the hackathon duration.

## 5. Next Steps for Integration
- **Member 1 (UI/UX):** Can now pull live data from the `segments` collection to render the actual heatmap overlay.
- **Member 4 (Coordination):** Backend is ready for final production merge.

---
*Generated via Antigravity AI Assistant during Session 01.*
