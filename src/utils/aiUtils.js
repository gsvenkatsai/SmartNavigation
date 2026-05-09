export async function safeGenerate(model, prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000
        })
      });
      
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      let raw = data.choices[0].message.content.trim();
      // Strip markdown code fences LLMs sometimes add
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
