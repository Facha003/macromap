import { z } from "zod";
import { ARCHETYPES, getArchetype } from "@/lib/nutrition/archetypes";
import { FOOD_CATALOG, INGREDIENT_KEYS, isFoodKey } from "@/lib/nutrition/catalog";
import type { EstimateBasis } from "@/lib/nutrition/basis";
import type { Selections } from "@/lib/nutrition/customize";
import { ROLES, type Component, type EstimateProvider, type Role } from "@/lib/nutrition/types";

/**
 * The model's job is limited to *interpreting* a menu entry: which dish type,
 * which ingredients, roughly how many grams. It never outputs nutrient values —
 * those are computed from the food-composition database.
 */

const gramsSchema = z.object({
  food: z.string(),
  role: z.string(),
  grams_min: z.number(),
  grams_likely: z.number(),
  grams_max: z.number(),
});

export const interpretationSchema = z.object({
  is_food: z.boolean(),
  archetype: z.string().nullable().optional(),
  selections: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number()])).nullable().optional(),
  components: z.array(gramsSchema).nullable().optional(),
  extras: z.array(gramsSchema).nullable().optional(),
  assumptions: z.array(z.string()).max(8).default([]),
  main_uncertainty: z.string().nullable().optional(),
});

export type Interpretation = z.infer<typeof interpretationSchema>;

export interface MenuText {
  name: string;
  description?: string | null;
  cuisines?: string[];
  restaurantName?: string;
}

export function buildPrompt(item: MenuText): { system: string; user: string } {
  const archetypes = ARCHETYPES.map((a) => {
    const opts = a.options
      .map((o) =>
        o.kind === "count"
          ? `${o.id}: integer ${o.min}-${o.max} (${o.unit})`
          : `${o.id}${o.kind === "multi" ? " (list)" : ""}: ${o.choices.map((ch) => ch.id).join("|")}`,
      )
      .join("; ");
    return `- ${a.id} (${a.label}). options → ${opts}`;
  }).join("\n");

  const ingredients = INGREDIENT_KEYS.map((k) => `${k} = ${FOOD_CATALOG[k].label}`).join("\n");

  const system = `You are a nutrition analyst for a restaurant nutrition app in Norway.
Your task is to interpret ONE restaurant menu entry into a structured recipe. You never output calories or nutrient numbers — the app computes them from a food-composition database.

Rules:
1. Only use ingredient keys from the list below. If an ingredient isn't listed, choose the closest listed food and mention it in "assumptions".
2. Gram amounts are for one serving as typically served in a Norwegian restaurant. Give a realistic min / likely / max range per ingredient. Use edible cooked weights except where the label says raw or dry.
3. Always account for hidden calories: cooking oil, butter, sauces, dressings, sugar in sauces and drinks.
4. If the dish fits one of the dish templates, set "archetype" and fill "selections" with option ids that match the menu text (leave out anything not stated). Use "extras" only for clearly stated ingredients the template lacks.
5. Otherwise set "archetype": null and list every ingredient in "components".
6. If the text is not a food or drink, or is too vague to estimate, set "is_food": false or return an empty components list and explain in "assumptions".
7. "assumptions": short, plain-English statements of what you assumed (max 5). "main_uncertainty": the single biggest unknown (e.g. "Sauce quantity").
8. Roles: ${ROLES.join(", ")}.

Dish templates:
${archetypes}

Ingredient keys:
${ingredients}

Respond with JSON only:
{"is_food": boolean, "archetype": string|null, "selections": object|null, "extras": [{"food","role","grams_min","grams_likely","grams_max"}]|null, "components": [same shape]|null, "assumptions": string[], "main_uncertainty": string|null}`;

  const user = [
    `Menu item: ${item.name}`,
    item.description ? `Description: ${item.description}` : "Description: (none)",
    item.cuisines?.length ? `Restaurant cuisine: ${item.cuisines.join(", ")}` : "",
    item.restaurantName ? `Restaurant: ${item.restaurantName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

const MAX_GRAMS = 1500;

function toComponents(rows: z.infer<typeof gramsSchema>[] | null | undefined, dropped: string[]): Component[] {
  const out: Component[] = [];
  for (const r of rows ?? []) {
    if (!isFoodKey(r.food) || FOOD_CATALOG[r.food].group === "dish_reference") {
      dropped.push(r.food);
      continue;
    }
    const role: Role = (ROLES as readonly string[]).includes(r.role) ? (r.role as Role) : "topping";
    const vals = [r.grams_min, r.grams_likely, r.grams_max].map((v) => Math.min(MAX_GRAMS, Math.max(0, Number(v) || 0)));
    const [min, likely, max] = vals.sort((a, b) => a - b);
    if (max <= 0) continue;
    out.push({ foodKey: r.food, role, grams: { min, likely, max } });
  }
  return out;
}

function validSelections(archetypeId: string, raw: Selections | null | undefined): Selections {
  const a = getArchetype(archetypeId)!;
  const out: Selections = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    const g = a.options.find((o) => o.id === id);
    if (!g) continue;
    if (g.kind === "count" && typeof v === "number" && Number.isFinite(v)) out[id] = Math.round(Math.min(g.max, Math.max(g.min, v)));
    if (g.kind === "single" && typeof v === "string" && g.choices.some((c) => c.id === v)) out[id] = v;
    if (g.kind === "multi") {
      const ids = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string" && g.choices.some((c) => c.id === x));
      if (ids.length) out[id] = ids;
    }
  }
  return out;
}

/** Converts validated model output into an estimate basis, or null if unusable. */
export function interpretationToBasis(raw: unknown, provider: EstimateProvider): EstimateBasis | null {
  const parsed = interpretationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const it = parsed.data;
  if (!it.is_food) {
    return { kind: "unavailable", reason: it.assumptions[0] ?? "This doesn't look like a food or drink item." };
  }
  const dropped: string[] = [];
  const assumptions = [...it.assumptions];

  if (it.archetype && getArchetype(it.archetype)) {
    const selections = validSelections(it.archetype, it.selections as Selections | null);
    const a = getArchetype(it.archetype)!;
    // Categorical facts become "known"; quantity questions stay open for the user.
    const known: Selections = {};
    const defaults: Selections = {};
    for (const [id, v] of Object.entries(selections)) {
      const g = a.options.find((o) => o.id === id)!;
      if (!g.narrows && g.kind !== "multi") known[id] = v;
      else defaults[id] = v;
    }
    const extras = toComponents(it.extras, dropped);
    if (dropped.length) assumptions.push(`Ignored unrecognised ingredients: ${dropped.join(", ")}.`);
    return { kind: "archetype", archetypeId: a.id, defaults, known, extras, provider, assumptions, mainUncertainty: it.main_uncertainty ?? null };
  }

  const components = toComponents(it.components, dropped);
  if (dropped.length) assumptions.push(`Ignored unrecognised ingredients: ${dropped.join(", ")}.`);
  if (!components.length) {
    return { kind: "unavailable", reason: assumptions[0] ?? "Not enough information to estimate this item." };
  }
  return { kind: "components", components, provider, assumptions, mainUncertainty: it.main_uncertainty ?? null };
}

/** Pulls the first JSON object out of a model reply (handles ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}
