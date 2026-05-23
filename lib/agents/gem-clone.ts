/**
 * AGENT-2 — Gem clone.
 * Reproduces the gemini.google.com Gem via the Gemini API:
 *   - system_instruction ← PARTAGE/gemini/00_INSTRUCTIONS_GEMINI.md
 *   - KB cached in explicit context cache (cf. cache-manager.ts)
 *   - same model family (Flash) as the Spark-powered Gem
 */

import { getGenai } from "../gemini-client";
import { getOrCreateCache, invalidateCache } from "../kb/cache-manager";
import { env } from "../env";
import type { GemResponse } from "../types";

/**
 * Extract citations from the Gem response.
 * Matches CGI articles, KB IDs (bnc_001, lm_023, etc.), formula IDs (FORM-XXX),
 * BOFiP refs, CGP/CSS articles.
 */
function extractCitations(text: string): string[] {
  const patterns = [
    /CGI\s+[Aa]rt\.?\s*[A-Z0-9\-]+(?:\s+[A-Z])?/g,
    /Art\.?\s*L\.?\s*\d+(?:\s+LPF)?/g,
    /FORM-\d{3}/g,
    /BOFiP-[A-Z0-9\-]+/g,
    /BOI-[A-Z0-9\-]+/g,
    /\b(?:bnc|lm|m\d+|gfpl|form)_\d{3,4}/gi,
  ];
  const all = new Set<string>();
  for (const re of patterns) {
    for (const m of text.matchAll(re)) all.add(m[0].trim());
  }
  return [...all];
}

/** First plausible fiscal millésime found in the answer (2020 → current year). */
function detectMillesime(text: string): string | null {
  const matches = text.matchAll(/\b(20[2-9]\d)\b/g);
  const years = [...matches].map((m) => m[1]);
  return years[0] ?? null;
}

export async function askGem(question: string): Promise<GemResponse> {
  const t0 = Date.now();
  let cache = await getOrCreateCache();

  let result;
  try {
    result = await getGenai().models.generateContent({
      model: env.GEMINI_MODEL_FAST,
      contents: question,
      config: {
        cachedContent: cache.name,
        temperature: 0.2,
      },
    });
  } catch (e) {
    // Cache may have been GC'd or expired between check and use — retry once.
    const message = e instanceof Error ? e.message : String(e);
    if (/cache|404|NOT_FOUND/i.test(message)) {
      invalidateCache();
      cache = await getOrCreateCache();
      result = await getGenai().models.generateContent({
        model: env.GEMINI_MODEL_FAST,
        contents: question,
        config: {
          cachedContent: cache.name,
          temperature: 0.2,
        },
      });
    } else {
      throw e;
    }
  }

  const text = result.text ?? "";
  const usage = result.usageMetadata;
  const cachedTokens = usage?.cachedContentTokenCount ?? 0;

  return {
    reponse_brute: text,
    citations_brutes: extractCitations(text),
    millesime_detecte: detectMillesime(text),
    tokens_input: usage?.promptTokenCount ?? 0,
    tokens_output: usage?.candidatesTokenCount ?? 0,
    cache_hit: cachedTokens > 0,
    latency_ms: Date.now() - t0,
  };
}
