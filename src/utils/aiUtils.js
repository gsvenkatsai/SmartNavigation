export async function safeGenerate(model, prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      let raw = result.response.text().trim();

      // Strip markdown code fences Gemini sometimes adds
      raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
      raw = raw.replace(/\s*```$/i, "").trim();

      return JSON.parse(raw);
    } catch (err) {
      if (attempt === retries) {
        console.error("[safeGenerate] All retries failed:", err);
        throw err;
      }
      // Wait 1s, then 2s before retrying
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      console.warn(`[safeGenerate] Retry ${attempt + 1}...`);
    }
  }
}
