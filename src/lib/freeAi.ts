import type { EstimateBasis } from "./nutrition/basis";
import { buildPrompt, extractJson, interpretationToBasis, type MenuText } from "./nutrition/llm";

/**
 * Free, keyless AI (Pollinations, https://pollinations.ai) used only to work
 * out a dish's likely ingredients and grams — nutrient values still come from
 * the food-composition database. The free tier allows ~1 reply per 45 s per
 * visitor, so callers should only use it for dishes with no estimate at all.
 */
const ENDPOINT = "https://text.pollinations.ai/openai";

export async function estimateWithFreeAi(item: MenuText, onWait?: (seconds: number) => void): Promise<EstimateBasis | null> {
  // Compact prompt (no dish templates) keeps the free model fast.
  const { system, user } = buildPrompt(item, { templates: false });
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 402 || res.status === 429) {
      // Free tier: one reply per ~45 s per visitor — wait once, then retry.
      onWait?.(46);
      await new Promise((r) => setTimeout(r, 46_000));
      continue;
    }
    if (!res.ok) throw new Error(`Free AI HTTP ${res.status}`);
    const json = await res.json();
    return interpretationToBasis(extractJson(json?.choices?.[0]?.message?.content ?? ""), "free_ai");
  }
  throw new Error("The free AI is busy — try again in a minute.");
}
