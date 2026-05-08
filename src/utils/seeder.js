import { doc, setDoc } from 'firebase/firestore';
import { db, segmentsCollection, sessionsCollection, reportsCollection } from '../services/firebase';

/**
 * Seeds Firestore with dummy data for Day 0 testing.
 * Enforces the strict schema definitions.
 */
export const seedDemoData = async () => {
  try {
    // 1. Seed segments
    // Contract: { segment_id, prefer_count, avoid_count, confidence, last_updated }
    const segmentDomlur = {
      segment_id: 'domlur-01',
      prefer_count: 3,
      avoid_count: 14,
      confidence: 0.85,
      last_updated: new Date()
    };
    await setDoc(doc(segmentsCollection, 'domlur-01'), segmentDomlur);

    const segmentSonySignal = {
      segment_id: 'sony-signal-02',
      prefer_count: 0,
      avoid_count: 20,
      confidence: 0.95,
      last_updated: new Date()
    };
    // simulating flooding
    await setDoc(doc(segmentsCollection, 'sony-signal-02'), segmentSonySignal);

    // 2. Seed sessions
    // Contract: { session_id, guest_route, live_waypoints, route_geometry, status, ai_warning, delay_flag, delay_message, why_avoid_text }
    const sessionActive = {
      session_id: 'session-host-guest-101',
      guest_route: 'Airport to Indiranagar',
      live_waypoints: [{ lat: 12.9716, lng: 77.5946 }, { lat: 12.9784, lng: 77.6408 }],
      route_geometry: 'encoded_polyline_here',
      status: 'active',
      ai_warning: 'Heavy traffic expected near Sony Signal due to flooding.',
      delay_flag: true,
      delay_message: 'Your host is delayed by 15 minutes.',
      why_avoid_text: 'Avoid Sony Signal due to reported flooding and 14 avoid votes.'
    };
    await setDoc(doc(sessionsCollection, 'session-host-guest-101'), sessionActive);

    // 3. Seed reports
    // Contract: { segment_id, report_text, ai_category, ai_severity, verification_status, created_at }
    const report1 = {
      segment_id: 'sony-signal-02',
      report_text: 'Water logging up to knee level',
      ai_category: 'flooding',
      ai_severity: 'high',
      verification_status: 'verified',
      created_at: new Date()
    };
    await setDoc(doc(reportsCollection, 'report-001'), report1);

    const report2 = {
      segment_id: 'domlur-01',
      report_text: 'Traffic is at a standstill for 20 mins',
      ai_category: 'traffic',
      ai_severity: 'medium',
      verification_status: 'pending',
      created_at: new Date()
    };
    await setDoc(doc(reportsCollection, 'report-002'), report2);

    const report3 = {
      segment_id: 'domlur-01',
      report_text: 'Accident blocking left lane',
      ai_category: 'accident',
      ai_severity: 'high',
      verification_status: 'verified',
      created_at: new Date()
    };
    await setDoc(doc(reportsCollection, 'report-003'), report3);

    console.log('Successfully seeded demo data!');
    alert('Demo data seeded successfully! Check Firebase console.');
  } catch (error) {
    console.error('Error seeding data:', error);
    alert('Error seeding data. Check console for details.');
  }
};
