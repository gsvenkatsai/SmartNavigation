import { db } from "../services/firebase";
import { model } from "../config/groq";
import { safeGenerate } from "../utils/aiUtils";
import { collection, query, where, getDocs,
         updateDoc, doc, Timestamp } from "firebase/firestore";
import { getWeather } from "../services/weatherService";

const buildPrompt = (report, weather, recentCount) => `
You are a report verification agent for Bangalore traffic intelligence.
Assess whether this traffic report is credible.

Parsed report: ${JSON.stringify(report)}
Current Bangalore weather: ${weather}
Similar reports on this segment in last 30 min: ${recentCount}

Rules:
- Rain/storm weather + flooding report → higher confidence
- 3+ similar recent reports → verified
- Single unverifiable claim, no corroboration → suspicious
- 1-2 similar reports → low_confidence

Respond ONLY with valid JSON. No explanation, no markdown:
{
  "verified": true or false,
  "confidence": "high" | "medium" | "low",
  "reason": "one sentence explanation"
}
`;

export async function runVerificationAgent(reportDocId, segmentId, parsedReport) {
  try {
    const weather = await getWeather();

    // Count recent similar reports on same segment
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const q = query(
      collection(db, "reports"),
      where("segment_id", "==", segmentId),
      where("created_at", ">=", Timestamp.fromDate(thirtyMinAgo))
    );
    const snap = await getDocs(q);
    const recentCount = snap.size;

    const result = await safeGenerate(
      model,
      buildPrompt(parsedReport, weather, recentCount)
    );

    const status = recentCount >= 3
      ? "verified"
      : result.verified
        ? "verified"
        : result.confidence === "low"
          ? "suspicious"
          : "low_confidence";

    await updateDoc(doc(db, "reports", reportDocId), {
      verification_status: status,
    });

    console.log("[Verification] Status:", status, "| Reason:", result.reason);

  } catch (err) {
    console.error("[Verification] Failed:", err);
  }
}
