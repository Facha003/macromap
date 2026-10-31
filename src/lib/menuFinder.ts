import { z } from "zod";
import { extractJson } from "./nutrition/llm";
import type { ParsedDish } from "./menuParse";

export interface FoundMenu {
  dishes: ParsedDish[];
  sources: { title: string; url: string }[];
  note: string | null;
}

const replySchema = z.object({
  found: z.boolean(),
  dishes: z
    .array(z.object({ name: z.string().min(2).max(120), description: z.string().max(500).nullable().optional(), price_nok: z.number().nullable().optional() }))
    .max(60)
    .default([]),
  notes: z.string().nullable().optional(),
});

/**
 * Asks Gemini to look up a restaurant's current menu with Google Search
 * grounding (the model searches the web itself — the restaurant's site,
 * delivery apps, reviews) and to return only dishes it found in those sources.
 * The source pages are returned so the user can check them before importing.
 */
export async function findMenuWithGemini(opts: {
  apiKey: string;
  model?: string;
  restaurant: { name: string; address: string | null; lat: number; lng: number; cuisines: string[]; website?: string | null };
}): Promise<FoundMenu> {
  const r = opts.restaurant;
  const where = r.address ? `${r.address}, Norway` : `near coordinates ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)} in Norway`;
  const prompt = `Find the CURRENT menu of the restaurant "${r.name}" located at ${where}.${r.cuisines.length ? ` Cuisine: ${r.cuisines.join(", ")}.` : ""}${r.website ? `
First read their own website: ${r.website} (and its menu pages).` : ""}
Then search the web (the restaurant's own website, Wolt, foodora, Just Eat, TripAdvisor, Google). Make sure the menu belongs to this exact restaurant at this location, not a different restaurant with a similar name.

Rules:
- Only list dishes that actually appear in the sources you found. Never invent dishes, descriptions or prices.
- Copy dish names as written (Norwegian is fine). Include the description/ingredients if the source has one, and the price in NOK if shown.
- Main food items and drinks only; skip extras, sauces sold separately and sides under 30 kr.
- At most 40 dishes.

Reply with JSON only, no other text:
{"found": true|false, "dishes": [{"name": "...", "description": "..." or null, "price_nok": number or null}], "notes": "which source(s) you used, or why nothing was found"}`;

  const model = opts.model || "gemini-flash-latest";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // url_context lets the model read the restaurant's site directly; google_search finds other sources.
      tools: [{ url_context: {} }, { google_search: {} }],
      generationConfig: { temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(res.status === 400 && /API key/i.test(body) ? "The Gemini key isn't valid." : res.status === 429 ? "Gemini's free quota is used up for today. Menus we found on restaurant websites are still shown automatically — try AI again tomorrow, or paste the menu." : `Gemini HTTP ${res.status}`);
  }
  const json = await res.json();
  const cand = json?.candidates?.[0];
  const text = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const sources = ((cand?.groundingMetadata?.groundingChunks ?? []) as { web?: { uri?: string; title?: string } }[])
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri))
    .map((w) => ({ title: w.title || new URL(w.uri).hostname, url: w.uri }))
    .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i)
    .slice(0, 8);

  const parsed = replySchema.safeParse(extractJson(text));
  if (!parsed.success) return { dishes: [], sources, note: "The AI's answer couldn't be read. Try again, or paste the menu instead." };
  const { found, dishes, notes } = parsed.data;
  // Without any web sources we can't show where the dishes came from — don't use them.
  if (!found || !dishes.length) return { dishes: [], sources, note: notes || "No menu found online for this restaurant." };
  if (!sources.length) return { dishes: [], sources, note: "The AI didn't cite any web sources, so its answer wasn't used. Try again, or paste the menu instead." };
  const seen = new Set<string>();
  return {
    dishes: dishes
      .map((d) => ({ name: d.name.trim(), description: d.description?.trim() || null, priceNok: typeof d.price_nok === "number" && d.price_nok > 0 && d.price_nok < 2000 ? d.price_nok : null }))
      .filter((d) => {
        const k = d.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    sources,
    note: notes ?? null,
  };
}
