import type { FoodGroup, FoodKey, FoodSourceDb } from "./catalog";

export interface Per100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** null = not reported by the source database */
  fiber: number | null;
  sugar: number | null;
  sodiumMg: number | null;
}

export interface FoodRecord {
  key: FoodKey;
  label: string;
  group: FoodGroup;
  source: FoodSourceDb;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  per100g: Per100g;
  portions: { name: string; grams: number }[];
  retrievedAt: string;
}

export interface FoodSnapshot {
  generatedAt: string;
  attribution: Record<FoodSourceDb, string>;
  foods: Record<FoodKey, FoodRecord>;
}

export interface Range {
  min: number;
  likely: number;
  max: number;
}

export const NUTRIENTS = ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "sodiumMg"] as const;
export type NutrientKey = (typeof NUTRIENTS)[number];

export const ROLES = [
  "protein",
  "base",
  "vegetable",
  "sauce",
  "cheese",
  "fat",
  "topping",
  "side",
  "milk",
  "sweetener",
  "pearls",
  "drink",
] as const;
export type Role = (typeof ROLES)[number];

export interface Component {
  foodKey: FoodKey;
  role: Role;
  grams: Range;
  note?: string;
}

/**
 * verified  — published by the restaurant/chain (with source URL)
 * external  — credible third-party data, e.g. a food-composition database's
 *             average for this exact kind of dish
 * estimated — computed from inferred ingredients and portions
 */
export type DataStatus = "verified" | "external" | "estimated";

export type EstimateProvider =
  | "official"
  | "reference_db"
  | "curated"
  | "template"
  | "gemini"
  | "groq"
  | "ollama"
  | "anthropic";

export interface NutritionValues {
  kcal: Range;
  protein: Range;
  carbs: Range;
  fat: Range;
  fiber: Range | null;
  sugar: Range | null;
  sodiumMg: Range | null;
}

export interface SourceRef {
  label: string;
  db: string;
  id: string;
  url: string;
}

export interface NutritionEstimate {
  status: DataStatus;
  provider: EstimateProvider;
  values: NutritionValues;
  servingG: Range | null;
  components: Component[];
  assumptions: string[];
  mainUncertainty: string | null;
  sources: SourceRef[];
  /** Optional sanity check against a database average for a comparable dish. */
  reference?: { label: string; kcal: Range; protein: Range; url: string } | null;
  computedAt: string;
}

/** Shape of an official / verified record imported by an admin. */
export interface OfficialNutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  sodiumMg?: number | null;
  servingG?: number | null;
  sourceUrl: string;
  checkedAt: string;
}
