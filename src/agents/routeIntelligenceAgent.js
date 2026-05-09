import { db } from "../services/firebase";
import { model } from "../config/groq";
import { safeGenerate } from "../utils/aiUtils";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { getWeather, isRaining } from "../services/weatherService";
import { runDelayDetection } from "./delayAgent";

const buildPrompt = (segments, weather, hour, isReroute) => `
You are a local traffic AI for Bangalore.
Generate a concise, specific navigation insight for a driver.
${isReroute ? "CONTEXT: The driver has just dynamically reshaped their route based on community intelligence." : ""}

High-avoid road segments nearby: ${JSON.stringify(segments)}
Current weather: ${weather}
Hour of day (24h): ${hour}

Rules:
- Max 20 words
- Be specific — mention actual location names from the segment data
- If isReroute is true, respond with an insight like "Community-corrected route actively avoids recently reported congestion."
- If hour is 7-10 or 15-18, mention school/office traffic
- If weather has rain, mention flooding risk
- If no significant issues, say "Route looks clear based on community data."

Respond ONLY with valid JSON:
{ "warning_text": "your warning here" }
`;

export async function runRouteIntelligence(sessionDocId, isReroute = false) {
  try {
    const weather = await getWeather();
    const raining = await isRaining();
    const hour = new Date().getHours();

    const segSnap = await getDocs(collection(db, "segments"));
    const highAvoid = segSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => (s.avoid_count || 0) > 3)
      .sort((a, b) => (b.avoid_count || 0) - (a.avoid_count || 0))
      .slice(0, 3);

    let warningText = "Route looks clear based on community data.";

    if (highAvoid.length > 0 || raining || isReroute) {
      const result = await safeGenerate(
        model,
        buildPrompt(highAvoid, weather, hour, isReroute)
      );
      warningText = result.warning_text;
    }

    await updateDoc(doc(db, "sessions", sessionDocId), {
      ai_warning: warningText,
    });

    console.log("[RouteIntel] Warning:", warningText);

    // Trigger delay detection using same segment data
    await runDelayDetection(sessionDocId, highAvoid);

  } catch (err) {
    console.error("[RouteIntel] Failed:", err);
  }
}
