/**
 * Fetches real per-100 g composition data for every entry in FOOD_CATALOG and
 * writes data/foods.snapshot.json. Run: `npm run seed:foods`
 *
 * Sources:
 *  - Matvaretabellen open API (https://www.matvaretabellen.no/api/) — CC BY 4.0
 *  - USDA FoodData Central API (https://fdc.nal.usda.gov/) — public domain.
 *    Uses USDA_FDC_API_KEY, or the rate-limited DEMO_KEY.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FOOD_CATALOG, type FoodKey } from "../src/lib/nutrition/catalog";
import type { FoodSnapshot, FoodRecord, Per100g } from "../src/lib/nutrition/types";

const MVT_URL = "https://www.matvaretabellen.no/api/en/foods.json";
const FDC_KEY = process.env.USDA_FDC_API_KEY || "DEMO_KEY";

interface MvtConstituent { nutrientId: string; quantity?: number; unit?: string }
interface MvtFood {
  foodId: string;
  foodName: string;
  uri: string;
  calories?: { quantity?: number };
  constituents: MvtConstituent[];
  portions?: { portionName: string; portionUnit: string; quantity: number; unit: string }[];
}

function mvtValue(food: MvtFood, id: string): number | null {
  const c = food.constituents.find((x) => x.nutrientId === id);
  return typeof c?.quantity === "number" ? c.quantity : null;
}

async function loadMvt(): Promise<Map<string, MvtFood>> {
  const res = await fetch(MVT_URL, { headers: { "User-Agent": "MacroMap seed script" } });
  if (!res.ok) throw new Error(`Matvaretabellen HTTP ${res.status}`);
  const json = (await res.json()) as { foods: MvtFood[] };
  return new Map(json.foods.map((f) => [f.foodId, f]));
}

async function loadUsda(fdcId: string) {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${FDC_KEY}`);
  if (!res.ok) throw new Error(`USDA FDC HTTP ${res.status} for ${fdcId}`);
  return (await res.json()) as {
    description: string;
    foodNutrients: { nutrient: { id: number }; amount?: number }[];
  };
}

function usdaValue(food: Awaited<ReturnType<typeof loadUsda>>, nutrientId: number): number | null {
  const n = food.foodNutrients.find((x) => x.nutrient.id === nutrientId);
  return typeof n?.amount === "number" ? n.amount : null;
}

async function main() {
  const retrievedAt = new Date().toISOString();
  const mvt = await loadMvt();
  const foods: Partial<Record<FoodKey, FoodRecord>> = {};
  const missing: string[] = [];

  for (const [key, entry] of Object.entries(FOOD_CATALOG) as [FoodKey, (typeof FOOD_CATALOG)[FoodKey]][]) {
    if (entry.source === "mvt") {
      const f = mvt.get(entry.id);
      if (!f) { missing.push(`${key} (mvt ${entry.id})`); continue; }
      const per100g: Per100g = {
        kcal: f.calories?.quantity ?? 0,
        protein: mvtValue(f, "Protein") ?? 0,
        carbs: mvtValue(f, "Karbo") ?? 0,
        fat: mvtValue(f, "Fett") ?? 0,
        fiber: mvtValue(f, "Fiber"),
        sugar: mvtValue(f, "Mono+Di"),
        sodiumMg: mvtValue(f, "Na"),
      };
      foods[key] = {
        key, label: entry.label, group: entry.group,
        source: "mvt", sourceId: f.foodId, sourceName: f.foodName, sourceUrl: f.uri,
        per100g,
        portions: (f.portions ?? []).filter((p) => p.unit === "g").map((p) => ({ name: p.portionName, grams: p.quantity })),
        retrievedAt,
      };
    } else {
      const f = await loadUsda(entry.id);
      foods[key] = {
        key, label: entry.label, group: entry.group,
        source: "usda", sourceId: entry.id, sourceName: f.description,
        sourceUrl: `https://fdc.nal.usda.gov/food-details/${entry.id}/nutrients`,
        per100g: {
          kcal: usdaValue(f, 1008) ?? 0,
          protein: usdaValue(f, 1003) ?? 0,
          carbs: usdaValue(f, 1005) ?? 0,
          fat: usdaValue(f, 1004) ?? 0,
          fiber: usdaValue(f, 1079),
          sugar: usdaValue(f, 2000),
          sodiumMg: usdaValue(f, 1093),
        },
        portions: [],
        retrievedAt,
      };
    }
  }

  if (missing.length) {
    console.error("Catalog entries not found in source data:\n  " + missing.join("\n  "));
    process.exit(1);
  }

  const snapshot: FoodSnapshot = {
    generatedAt: retrievedAt,
    attribution: {
      mvt: "Matvaretabellen, Norwegian Food Safety Authority (Mattilsynet) — CC BY 4.0 — matvaretabellen.no",
      usda: "USDA FoodData Central, U.S. Department of Agriculture — public domain — fdc.nal.usda.gov",
    },
    foods: foods as Record<FoodKey, FoodRecord>,
  };

  const out = join(process.cwd(), "data", "foods.snapshot.json");
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot, null, 1));
  for (const f of Object.values(snapshot.foods)) {
    console.log(`${f.key.padEnd(24)} ${f.source}:${f.sourceId.padEnd(7)} ${String(f.per100g.kcal).padStart(5)} kcal  P${f.per100g.protein} C${f.per100g.carbs} F${f.per100g.fat}  ← ${f.sourceName}`);
  }
  console.log(`\nWrote ${Object.keys(snapshot.foods).length} foods to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
