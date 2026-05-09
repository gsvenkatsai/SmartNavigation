/**
 * aiUtils.js — Safe LLM wrapper using Groq REST API
 * All calls go through Vite dev proxy at /groq-api to avoid CORS.
 * Includes circuit breaker for 429 quota exhaustion.
 */

const GROQ_PROXY = "/groq-api";

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

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    console.error("[safeGenerate] VITE_GROQ_API_KEY is not set!");
    return { ...FALLBACK_RESULT };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = `${GROQ_PROXY}/openai/v1/chat/completions`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: "json_object" },
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

        throw new Error(`Groq API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      let raw = data.choices?.[0]?.message?.content?.trim();

      if (!raw) {
        throw new Error("Empty response from Groq");
      }

      // Strip markdown code fences LLMs sometimes add (though response_format should help)
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
