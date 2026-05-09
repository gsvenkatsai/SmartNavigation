import { db } from "../services/firebase";
import { model } from "../config/groq";
import { safeGenerate } from "../utils/aiUtils";
import { collection, query, where, getDocs,
         updateDoc, doc, orderBy, limit } from "firebase/firestore";

const buildPrompt = (reports) => `
You are summarizing why local drivers avoid a specific road segment in Bangalore.
Recent community reports about this segment:
${reports.map((r, i) => `${i + 1}. "${r}"`).join("\n")}

Write a single grounded explanation sentence that sounds like local knowledge.
Max 15 words. No filler. Be specific.

Respond ONLY with valid JSON:
{ "summary": "your one sentence here" }
`;

export async function runWhyAvoidAgent(segmentId, sessionDocId) {
  try {
    const q = query(
      collection(db, "reports"),
      where("segment_id", "==", segmentId),
      orderBy("created_at", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);
    const texts = snap.docs
      .map(d => d.data().report_text)
      .filter(Boolean);

    if (texts.length === 0) {
      await updateDoc(doc(db, "sessions", sessionDocId), {
        why_avoid_text: "No community reports for this segment yet.",
      });
      return;
    }

    const result = await safeGenerate(model, buildPrompt(texts));

    await updateDoc(doc(db, "sessions", sessionDocId), {
      why_avoid_text: result.summary,
    });

    console.log("[WhyAvoid] Summary:", result.summary);

  } catch (err) {
    console.error("[WhyAvoid] Failed:", err);
  }
}
