import snapshotJson from "../../../data/foods.snapshot.json";
import { FOOD_CATALOG, type FoodKey } from "./catalog";
import type {
  Component,
  DataStatus,
  EstimateProvider,
  FoodRecord,
  FoodSnapshot,
  NutrientKey,
  NutritionEstimate,
  NutritionValues,
  OfficialNutrition,
  Range,
  SourceRef,
} from "./types";

export const FOODS = (snapshotJson as unknown as FoodSnapshot).foods;
export const FOOD_ATTRIBUTION = (snapshotJson as unknown as FoodSnapshot).attribution;
export const FOODS_RETRIEVED_AT = (snapshotJson as unknown as FoodSnapshot).generatedAt;

export function food(key: FoodKey): FoodRecord {
  const f = FOODS[key];
  if (!f) throw new Error(`Food "${key}" missing from snapshot — run npm run seed:foods`);
  return f;
}

/**
 * Relative error floor applied on top of portion uncertainty for ingredient-based
 * estimates. It covers variation between the database's reference food and what a
 * kitchen actually uses (recipes, cuts, absorbed oil). It is a modelling choice,
 * not a measured accuracy — see docs/VALIDATION.md.
 */
const MODEL_ERROR: Record<EstimateProvider, number> = {
  official: 0,
  reference_db: 0.1,
  curated: 0.08,
  template: 0.1,
  gemini: 0.1,
  groq: 0.1,
  ollama: 0.12,
  anthropic: 0.1,
  free_ai: 0.12,
};

const r = (likely: number, min = likely, max = likely): Range => ({ min, likely, max });

function sumRange(
  components: Component[],
  perGram: (c: Component) => number,
  errorFloor: number,
): Range {
  let likely = 0;
  let lowSq = 0;
  let highSq = 0;
  for (const c of components) {
    const v = perGram(c);
    likely += c.grams.likely * v;
    lowSq += ((c.grams.likely - c.grams.min) * v) ** 2;
    highSq += ((c.grams.max - c.grams.likely) * v) ** 2;
  }
  // Portion errors of different components are treated as independent, so they
  // combine in quadrature instead of stacking every worst case.
  const floorSq = (likely * errorFloor) ** 2;
  return {
    min: Math.max(0, likely - Math.sqrt(lowSq + floorSq)),
    likely,
    max: likely + Math.sqrt(highSq + floorSq),
  };
}

export function nutrientsFromComponents(components: Component[], errorFloor: number): NutritionValues {
  const get = (n: NutrientKey) => (c: Component) => {
    const v = food(c.foodKey).per100g[n];
    return (v ?? 0) / 100;
  };
  const optional = (n: "fiber" | "sugar" | "sodiumMg") =>
    components.every((c) => food(c.foodKey).per100g[n] !== null) ? sumRange(components, get(n), errorFloor) : null;
  return {
    kcal: sumRange(components, get("kcal"), errorFloor),
    protein: sumRange(components, get("protein"), errorFloor),
    carbs: sumRange(components, get("carbs"), errorFloor),
    fat: sumRange(components, get("fat"), errorFloor),
    fiber: optional("fiber"),
    sugar: optional("sugar"),
    sodiumMg: optional("sodiumMg"),
  };
}

function servingRange(components: Component[]): Range {
  return sumRange(components, () => 1, 0);
}

function sourcesFor(components: Component[]): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const c of components) {
    if (seen.has(c.foodKey)) continue;
    seen.add(c.foodKey);
    const f = food(c.foodKey);
    out.push({ label: f.sourceName, db: f.source === "mvt" ? "Matvaretabellen" : "USDA FoodData Central", id: f.sourceId, url: f.sourceUrl });
  }
  return out;
}

/** A recipe made mostly of whole-dish database averages counts as an external reference, not an estimate. */
function statusFor(components: Component[]): DataStatus {
  const total = components.reduce((s, c) => s + c.grams.likely, 0);
  const refMass = components
    .filter((c) => FOOD_CATALOG[c.foodKey].group === "dish_reference")
    .reduce((s, c) => s + c.grams.likely, 0);
  return total > 0 && refMass / total >= 0.8 ? "external" : "estimated";
}

export interface EstimateInput {
  components: Component[];
  provider: EstimateProvider;
  assumptions: string[];
  mainUncertainty: string | null;
  referenceKey?: FoodKey | null;
}

export function estimateFromComponents(input: EstimateInput): NutritionEstimate {
  const components = input.components.filter((c) => c.grams.likely > 0 || c.grams.max > 0);
  const status = statusFor(components);
  const provider = status === "external" && input.provider === "curated" ? "reference_db" : input.provider;
  const values = nutrientsFromComponents(components, MODEL_ERROR[provider]);
  const servingG = servingRange(components);

  let reference: NutritionEstimate["reference"] = null;
  if (input.referenceKey && status !== "external") {
    const ref = food(input.referenceKey);
    const k = ref.per100g.kcal / 100;
    const p = ref.per100g.protein / 100;
    reference = {
      label: ref.sourceName,
      kcal: { min: servingG.min * k, likely: servingG.likely * k, max: servingG.max * k },
      protein: { min: servingG.min * p, likely: servingG.likely * p, max: servingG.max * p },
      url: ref.sourceUrl,
    };
  }

  return {
    status,
    provider,
    values,
    servingG,
    components,
    assumptions: input.assumptions,
    mainUncertainty: input.mainUncertainty,
    sources: sourcesFor(components),
    reference,
    computedAt: new Date().toISOString(),
  };
}

export function estimateFromOfficial(o: OfficialNutrition): NutritionEstimate {
  const opt = (v: number | null | undefined) => (typeof v === "number" ? r(v) : null);
  return {
    status: "verified",
    provider: "official",
    values: {
      kcal: r(o.kcal),
      protein: r(o.protein),
      carbs: r(o.carbs),
      fat: r(o.fat),
      fiber: opt(o.fiber),
      sugar: opt(o.sugar),
      sodiumMg: opt(o.sodiumMg),
    },
    servingG: o.servingG ? r(o.servingG) : null,
    components: [],
    assumptions: [],
    mainUncertainty: null,
    sources: [{ label: "Published by the restaurant", db: "Official", id: "", url: o.sourceUrl }],
    reference: null,
    computedAt: o.checkedAt,
  };
}

export function scaleEstimate(e: NutritionEstimate, factor: number): NutritionEstimate {
  const s = (x: Range | null): Range | null => (x ? { min: x.min * factor, likely: x.likely * factor, max: x.max * factor } : null);
  return {
    ...e,
    values: {
      kcal: s(e.values.kcal)!,
      protein: s(e.values.protein)!,
      carbs: s(e.values.carbs)!,
      fat: s(e.values.fat)!,
      fiber: s(e.values.fiber),
      sugar: s(e.values.sugar),
      sodiumMg: s(e.values.sodiumMg),
    },
    servingG: s(e.servingG),
  };
}

/** Grams of protein per 100 kcal — the comparison efficiency metric. */
export function proteinPer100kcal(v: NutritionValues): number {
  return v.kcal.likely > 0 ? (v.protein.likely / v.kcal.likely) * 100 : 0;
}

/** Relative width of the kcal range; 0 for verified values. */
export function rangeWidth(v: Range): number {
  return v.likely > 0 ? (v.max - v.min) / v.likely : 0;
}
