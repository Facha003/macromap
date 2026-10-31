import { haversineM } from "./geo";
import { resolveBasis } from "./nutrition/basis";
import { inferDiet } from "./nutrition/diet";
import type { DataStatus, EstimateProvider, NutritionValues } from "./nutrition/types";
import type { MealFilters } from "./queryParser";
import { scoreMeal, type Goals, type Totals } from "./scoring";
import type { MealView } from "@/server/repo/menu";

export interface MealResult {
  meal: MealView;
  values: NutritionValues;
  status: DataStatus;
  provider: EstimateProvider;
  distanceM: number;
  score: number;
  reasons: string[];
  diet: { vegetarian: boolean; vegan: boolean; halal: boolean; inferred: boolean };
}

export interface RestaurantLite {
  id: string;
  name: string;
  cuisines: string[];
  distanceM: number;
  menuCount: number;
}

export interface SearchResponse {
  results: MealResult[];
  /** Restaurants matching the text that have no menu data yet — shown honestly, not hidden. */
  noMenuMatches: Pick<RestaurantLite, "id" | "name" | "cuisines" | "distanceM">[];
  scanned: { restaurants: number; withMenus: number; meals: number };
  liveError: string | null;
  pending: boolean;
}

export function matchesText(hay: string, text: string): boolean {
  if (!text) return true;
  const h = hay.toLowerCase();
  const synonyms: Record<string, string[]> = { chicken: ["kylling"], salmon: ["laks"], beef: ["biff", "okse", "döner", "doner"], boba: ["bubble", "milk tea", "pearl"], coffee: ["latte", "kaffe", "cappuccino", "flat white"] };
  return text.split(/\s+/).every((t) => h.includes(t) || (synonyms[t] ?? []).some((s) => h.includes(s)) || (t.endsWith("s") && h.includes(t.slice(0, -1))));
}

/** Filters and ranks meals against the user's goals. Pure — used by server and static builds. */
export function rankMeals(args: {
  meals: MealView[];
  restaurants: RestaurantLite[];
  filters: MealFilters;
  lat: number;
  lng: number;
  goals: Goals;
  consumed: Totals;
  limit?: number;
}): Pick<SearchResponse, "results" | "noMenuMatches"> {
  const { filters: f } = args;
  const remaining = Math.max(0, args.goals.kcalTarget - args.consumed.kcal);
  const byId = new Map(args.restaurants.map((r) => [r.id, r]));
  const results: MealResult[] = [];

  for (const meal of args.meals) {
    const r = byId.get(meal.restaurant.id);
    if (!r) continue;
    if (!matchesText(`${meal.name} ${meal.description ?? ""} ${r.name} ${r.cuisines.join(" ")} ${meal.category ?? ""}`, f.text)) continue;
    const { estimate } = resolveBasis(meal.basis);
    if (!estimate) continue;
    const v = estimate.values;
    if (f.maxKcal != null && v.kcal.likely > f.maxKcal) continue;
    if (f.minKcal != null && v.kcal.likely < f.minKcal) continue;
    if (f.minProtein != null && v.protein.likely < f.minProtein) continue;
    if (f.withinBudget && v.kcal.likely > remaining) continue;

    const inferred = inferDiet(estimate.components);
    const stated = meal.statedDiet;
    const diet = {
      vegetarian: stated.vegetarian ?? inferred.vegetarian,
      vegan: stated.vegan ?? inferred.vegan,
      halal: Boolean(stated.halal || meal.restaurant.halal),
      inferred: stated.vegetarian === undefined && stated.vegan === undefined,
    };
    if (f.vegetarian && !diet.vegetarian) continue;
    if (f.vegan && !diet.vegan) continue;
    if (f.halal && !diet.halal) continue;

    const distanceM = haversineM({ lat: args.lat, lng: args.lng }, meal.restaurant);
    const s = scoreMeal({ values: v, status: estimate.status, distanceM }, args.goals, args.consumed);
    results.push({ meal, values: v, status: estimate.status, provider: estimate.provider, distanceM, score: s.score, reasons: s.reasons, diet });
  }

  const sorters: Record<NonNullable<MealFilters["sort"]>, (a: MealResult, b: MealResult) => number> = {
    score: (a, b) => b.score - a.score,
    protein_density: (a, b) => b.values.protein.likely / b.values.kcal.likely - a.values.protein.likely / a.values.kcal.likely,
    kcal: (a, b) => a.values.kcal.likely - b.values.kcal.likely,
    protein: (a, b) => b.values.protein.likely - a.values.protein.likely,
    distance: (a, b) => a.distanceM - b.distanceM,
  };
  results.sort(sorters[f.sort ?? "score"]);

  const noMenuMatches = f.text
    ? args.restaurants
        .filter((r) => r.menuCount === 0 && matchesText(`${r.name} ${r.cuisines.join(" ")}`, f.text))
        .slice(0, 8)
        .map(({ id, name, cuisines, distanceM }) => ({ id, name, cuisines, distanceM }))
    : [];

  return { results: results.slice(0, args.limit ?? 60), noMenuMatches };
}

/** Builds filters from the search request parameters (shared by API route and static build). */
export function filtersFromParams(p: URLSearchParams, parsed: MealFilters): MealFilters {
  const num = (k: string, min: number, max: number) => {
    const n = Number(p.get(k));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
  };
  const flag = (k: string) => (p.get(k) === "1" ? true : p.get(k) === "0" ? false : undefined);
  return {
    ...parsed,
    // 0 = explicitly cleared
    maxKcal: p.has("maxKcal") ? num("maxKcal", 0, 5000) || undefined : parsed.maxKcal,
    minProtein: p.has("minProtein") ? num("minProtein", 0, 300) : parsed.minProtein,
    maxDistanceKm: p.has("km") ? num("km", 0.2, 5) : parsed.maxDistanceKm,
    vegetarian: flag("vegetarian") ?? parsed.vegetarian,
    vegan: flag("vegan") ?? parsed.vegan,
    halal: flag("halal") ?? parsed.halal,
    withinBudget: flag("budget") ?? parsed.withinBudget,
    sort: (["score", "protein_density", "kcal", "distance", "protein"] as const).find((s) => s === p.get("sort")) ?? parsed.sort,
  };
}
