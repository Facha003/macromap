import { haversineM } from "./geo";
import { resolveBasis } from "./nutrition/basis";
import { inferDiet } from "./nutrition/diet";
import type { DataStatus, EstimateProvider, NutritionValues } from "./nutrition/types";
import type { MealFilters } from "./queryParser";
import { scoreMeal, type Goals, type Totals } from "./scoring";
import { containsPork, halalStatus, passesHalalFilter, type HalalReport, type HalalStatus } from "./halal";
import type { MealView } from "@/server/repo/menu";

export interface MealResult {
  meal: MealView;
  values: NutritionValues;
  status: DataStatus;
  provider: EstimateProvider;
  distanceM: number;
  score: number;
  reasons: string[];
  diet: { vegetarian: boolean; vegan: boolean; halal: HalalStatus; pork: boolean; inferred: boolean };
  /**
   * fits     — the whole estimated range meets the limits (or there are no numeric limits)
   * possibly — only the most likely value meets them; the range crosses a limit
   */
  fit: "fits" | "possibly";
  /** Why it only possibly fits, e.g. "could be up to 750 kcal (limit 650)". */
  fitNotes: string[];
}

/** Checks numeric limits against both the most likely value and the full range. */
export function rangeFit(v: NutritionValues, f: Pick<MealFilters, "maxKcal" | "minKcal" | "minProtein">, maxBudget: number | null): { likelyOk: boolean; fit: MealResult["fit"]; notes: string[] } {
  const notes: string[] = [];
  let likelyOk = true;
  const k = v.kcal;
  const p = v.protein;
  const max = Math.min(f.maxKcal ?? Infinity, maxBudget ?? Infinity);
  if (Number.isFinite(max)) {
    if (k.likely > max) likelyOk = false;
    else if (k.max > max) notes.push(`could be up to ${Math.round(k.max / 10) * 10} kcal (limit ${Math.round(max)})`);
  }
  if (f.minKcal != null) {
    if (k.likely < f.minKcal) likelyOk = false;
    else if (k.min < f.minKcal) notes.push(`could be as low as ${Math.round(k.min / 10) * 10} kcal`);
  }
  if (f.minProtein != null) {
    if (p.likely < f.minProtein) likelyOk = false;
    else if (p.min < f.minProtein) notes.push(`protein could be as low as ${Math.round(p.min)} g (target ${f.minProtein} g)`);
  }
  return { likelyOk, fit: notes.length ? "possibly" : "fits", notes };
}

export interface RestaurantLite {
  id: string;
  name: string;
  cuisines: string[];
  distanceM: number;
  menuCount: number;
}

export interface SearchResponse {
  /** Dishes from real menus (restaurant website, users, imports, demo). */
  results: MealResult[];
  /** Generic dishes for restaurants without a menu — never mixed into `results`. */
  typicalResults: MealResult[];
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
  halalReports?: Record<string, HalalReport>;
}): Pick<SearchResponse, "results" | "typicalResults" | "noMenuMatches"> {
  const { filters: f } = args;
  const remaining = Math.max(0, args.goals.kcalTarget - args.consumed.kcal);
  const byId = new Map(args.restaurants.map((r) => [r.id, r]));
  const results: MealResult[] = [];

  for (const meal of args.meals) {
    const r = byId.get(meal.restaurant.id);
    if (!r) continue;
    if (f.realOnly && meal.sourceType === "typical") continue;
    if (!matchesText(`${meal.name} ${meal.description ?? ""} ${r.name} ${r.cuisines.join(" ")} ${meal.category ?? ""}`, f.text)) continue;
    const { estimate } = resolveBasis(meal.basis);
    if (!estimate) continue;
    const v = estimate.values;
    const fit = rangeFit(v, f, f.withinBudget ? remaining : null);
    if (!fit.likelyOk) continue;
    if (f.strict && fit.fit !== "fits") continue;

    const inferred = inferDiet(estimate.components);
    const stated = meal.statedDiet;
    const pork = containsPork(estimate.components);
    const halal = halalStatus(
      { name: meal.restaurant.name, cuisines: meal.restaurant.cuisines, halalTag: meal.restaurant.halalTag ?? (meal.restaurant.halal ? "yes" : null), statedHalal: stated.halal },
      args.halalReports?.[meal.restaurant.id],
    ).status;
    const diet = {
      vegetarian: stated.vegetarian ?? inferred.vegetarian,
      vegan: stated.vegan ?? inferred.vegan,
      halal,
      pork,
      inferred: stated.vegetarian === undefined && stated.vegan === undefined,
    };
    if (f.vegetarian && !diet.vegetarian) continue;
    if (f.vegan && !diet.vegan) continue;
    // Halal: affirmative restaurant-level evidence (or opted-in "possibly halal"), and no pork/alcohol in the dish.
    if (f.halal && (!passesHalalFilter(halal, f.halalPossible) || pork)) continue;

    const distanceM = haversineM({ lat: args.lat, lng: args.lng }, meal.restaurant);
    const s = scoreMeal({ values: v, status: estimate.status, distanceM }, args.goals, args.consumed);
    results.push({ meal, values: v, status: estimate.status, provider: estimate.provider, distanceM, score: s.score, reasons: s.reasons, diet, fit: fit.fit, fitNotes: fit.notes });
  }

  const sorters: Record<NonNullable<MealFilters["sort"]>, (a: MealResult, b: MealResult) => number> = {
    score: (a, b) => b.score - a.score,
    protein_density: (a, b) => b.values.protein.likely / b.values.kcal.likely - a.values.protein.likely / a.values.kcal.likely,
    kcal: (a, b) => a.values.kcal.likely - b.values.kcal.likely,
    protein: (a, b) => b.values.protein.likely - a.values.protein.likely,
    distance: (a, b) => a.distanceM - b.distanceM,
  };
  // With numeric limits, meals whose whole range fits come before ones that only possibly fit.
  const hasLimits = f.maxKcal != null || f.minKcal != null || f.minProtein != null || f.withinBudget;
  results.sort((a, b) => (hasLimits ? Number(a.fit !== "fits") - Number(b.fit !== "fits") : 0) || sorters[f.sort ?? "score"](a, b));

  const noMenuMatches = f.text
    ? args.restaurants
        .filter((r) => r.menuCount === 0 && matchesText(`${r.name} ${r.cuisines.join(" ")}`, f.text))
        .slice(0, 8)
        .map(({ id, name, cuisines, distanceM }) => ({ id, name, cuisines, distanceM }))
    : [];

  // Real menu items and generic examples are kept in separate lists, never interleaved.
  const real = results.filter((r) => r.meal.sourceType !== "typical");
  const typical = results.filter((r) => r.meal.sourceType === "typical");
  return { results: real.slice(0, args.limit ?? 60), typicalResults: typical.slice(0, 20), noMenuMatches };
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
    halalPossible: flag("halalPossible") ?? parsed.halalPossible,
    withinBudget: flag("budget") ?? parsed.withinBudget,
    realOnly: flag("real") ?? parsed.realOnly,
    strict: flag("strict") ?? parsed.strict,
    sort: (["score", "protein_density", "kcal", "distance", "protein"] as const).find((s) => s === p.get("sort")) ?? parsed.sort,
  };
}
