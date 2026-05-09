/**
 * aiUtils.js — Safe LLM wrapper using Gemini REST API
 * All calls go through Vite dev proxy at /gemini-api to avoid CORS.
 * Includes circuit breaker for 429 quota exhaustion.
 */

const GEMINI_PROXY = "/gemini-api";

// ─── Circuit breaker state ──────────────────────────────────────────────────
let quotaExhausted = false;
let quotaResetTimer = null;

const FALLBACK_RESULT = {
  warning_text: "⚡ Community data active — AI analysis on cooldown",
  warning: "AI analysis temporarily unavailable. Using community data.",
  confidence: "offline",
  suggestions: [],
  summary: "Community data active — AI analysis temporarily paused.",
  delay_flag: false,
  delay_message: "",
  type: "unknown",
  severity: "low",
  verified: false,
  reason: "AI quota cooldown",
};

export async function safeGenerate(model, prompt, retries = 2) {
  // Circuit breaker: if quota is exhausted, return fallback immediately
  if (quotaExhausted) {
    console.warn("[safeGenerate] Quota exhausted — returning cached fallback");
    return { ...FALLBACK_RESULT };
  }

  const apiKey = import.meta.env.VITE_GEMINI_KEY;
  if (!apiKey) {
    console.error("[safeGenerate] VITE_GEMINI_KEY is not set!");
    return { ...FALLBACK_RESULT };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = `${GEMINI_PROXY}/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");

        // 429 = quota exhausted → trip circuit breaker
        if (response.status === 429) {
          console.warn("[safeGenerate] 429 Quota exhausted — circuit breaker ON for 5 min");
          quotaExhausted = true;
          if (quotaResetTimer) clearTimeout(quotaResetTimer);
          quotaResetTimer = setTimeout(() => {
            quotaExhausted = false;
            console.log("[safeGenerate] Circuit breaker RESET — retrying API calls");
          }, 300000); // 5 minutes
          return { ...FALLBACK_RESULT };
        }

        throw new Error(`Gemini API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      let raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!raw) {
        throw new Error("Empty response from Gemini");
      }

      // Strip markdown code fences LLMs sometimes add
      raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
      raw = raw.replace(/\s*```$/i, "").trim();

      return JSON.parse(raw);
    } catch (err) {
      if (attempt === retries) {
        console.error("[safeGenerate] All retries failed:", err);
        // Return fallback instead of throwing to prevent UI errors
        return { ...FALLBACK_RESULT };
      }
      // Wait 1s, then 2s before retrying
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      console.warn(`[safeGenerate] Retry ${attempt + 1}...`);
    }
  }
}
