import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// SCHEMA CONTRACTS
// These definitions are locked contracts for the rest of the team.
// They document the exact structure required for Firestore collections.

/**
 * Collection: "segments"
 * Contract: { segment_id, prefer_count, avoid_count, confidence, last_updated }
 */
export const segmentsCollection = collection(db, 'segments');

/**
 * Collection: "sessions"
 * Contract: { session_id, guest_route, live_waypoints, route_geometry, status, ai_warning, delay_flag, delay_message, why_avoid_text }
 */
export const sessionsCollection = collection(db, 'sessions');

/**
 * Collection: "reports"
 * Contract: { segment_id, report_text, ai_category, ai_severity, verification_status, created_at }
 */
export const reportsCollection = collection(db, 'reports');

export default app;
