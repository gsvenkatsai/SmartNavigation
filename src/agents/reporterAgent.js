import { db } from "../services/firebase";
import { model } from "../config/gemini";
import { safeGenerate } from "../utils/aiUtils";
import { collection, query, where, onSnapshot,
         updateDoc, doc } from "firebase/firestore";
import { runVerificationAgent } from "./verificationAgent";
import { updateConfidence } from "./confidenceAgent";

const buildPrompt = (text) => `
You are a traffic intelligence agent for Bangalore.
Parse this community report into structured data.

Report: "${text}"

Respond ONLY with valid JSON. No explanation, no markdown fences.
Use exactly these fields and allowed values:
{
  "type": "flooding" | "pothole" | "accident" | "construction" | "congestion",
  "severity": "high" | "medium" | "low",
  "location": "short location name as string"
}
`;

export function startReporterAgent() {
  const q = query(
    collection(db, "reports"),
    where("ai_category", "==", "")
  );

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added") continue;

      const reportData = change.doc.data();
      const reportId = change.doc.id;

      if (!reportData.report_text) continue;

      console.log("[Reporter] Processing:", reportData.report_text);

      try {
        const parsed = await safeGenerate(
          model,
          buildPrompt(reportData.report_text)
        );

        await updateDoc(doc(db, "reports", reportId), {
          ai_category: parsed.type,
          ai_severity: parsed.severity,
        });

        console.log("[Reporter] Wrote:", parsed);

        // Trigger downstream agents
        await runVerificationAgent(
          reportId,
          reportData.segment_id,
          parsed
        );
        await updateConfidence(reportData.segment_id);

      } catch (err) {
        console.error("[Reporter] Failed for doc:", reportId, err);
      }
    }
  });

  return unsubscribe; // caller can use this to stop listening
}
