import { db } from "../services/firebase";
import { model } from "../config/groq";
import { safeGenerate } from "../utils/aiUtils";
import { updateDoc, doc } from "firebase/firestore";

const THRESHOLD = 8; // avoid_count above this = severe congestion

const buildPrompt = (segment) => `
This road segment has severe congestion based on community reports.
Segment data: ${JSON.stringify(segment)}

Generate a WhatsApp message a driver would send to notify they're running late.
Rules:
- Max 15 words
- Casual and natural tone
- Mention the location from segment data
- Estimate delay between 10-25 minutes based on avoid_count severity

Respond ONLY with valid JSON:
{
  "delay_flag": true,
  "delay_minutes": number,
  "delay_message": "the WhatsApp message text"
}
`;

export async function runDelayDetection(sessionDocId, segments) {
  try {
    const severeSegment = segments.find(
      s => (s.avoid_count || 0) >= THRESHOLD
    );

    if (!severeSegment) {
      console.log("[Delay] No severe congestion detected.");
      return;
    }

    const result = await safeGenerate(model, buildPrompt(severeSegment));

    await updateDoc(doc(db, "sessions", sessionDocId), {
      delay_flag: result.delay_flag,
      delay_message: result.delay_message,
    });

    console.log("[Delay] Flagged:", result.delay_message);

  } catch (err) {
    console.error("[Delay] Failed:", err);
  }
}
