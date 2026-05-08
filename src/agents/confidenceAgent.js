import { db } from "../config/firebase";
import { collection, query, where, getDocs,
         updateDoc, doc } from "firebase/firestore";

export async function updateConfidence(segmentId) {
  if (!segmentId) return;

  try {
    // Count all reports for this segment
    const q = query(
      collection(db, "reports"),
      where("segment_id", "==", segmentId)
    );
    const snap = await getDocs(q);
    const count = snap.size;

    // Scoring logic per contract spec
    const confidence = count > 10 ? "high"
                     : count > 3  ? "medium"
                     :              "low";

    await updateDoc(doc(db, "segments", segmentId), {
      confidence,
      last_updated: new Date().toISOString(),
    });

    console.log(`[Confidence] ${segmentId}: ${count} reports → ${confidence}`);

  } catch (err) {
    console.error("[Confidence] Failed:", err);
  }
}
