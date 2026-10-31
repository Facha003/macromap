import "server-only";
import { haversineM } from "@/lib/geo";
import { resolveBasis } from "@/lib/nutrition/basis";
import { inferDiet } from "@/lib/nutrition/diet";
import type { DataStatus, EstimateProvider, NutritionValues } from "@/lib/nutrition/types";
import type { MealFilters } from "@/lib/queryParser";
import { scoreMeal, type Goals, type Totals } from "@/lib/scoring";
import { discover, type RestaurantSummary } from "./places";
import { mealViews, type MealView } from "./repo/menu";

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

export interface SearchResponse {
  results: MealResult[];
  /** Restaurants matching the text that have no menu data yet — shown honestly, not hidden. */
  noMenuMatches: Pick<RestaurantSummary, "id" | "name" | "cuisines" | "distanceM">[];
  scanned: { restaurants: number; withMenus: number; meals: number };
  liveError: string | null;
  pending: boolean;
}

function matchesText(hay: string, text: string): boolean {
  if (!text) return true;
  const h = hay.toLowerCase();
  const synonyms: Record<string, string[]> = { chicken: ["kylling"], salmon: ["laks"], beef: ["biff", "okse", "döner", "doner"], boba: ["bubble", "milk tea", "pearl"], coffee: ["latte", "kaffe", "cappuccino", "flat white"] };
  return text.split(/\s+/).every((t) => h.includes(t) || (synonyms[t] ?? []).some((s) => h.includes(s)) || (t.endsWith("s") && h.includes(t.slice(0, -1))));
}

export async function searchMeals(args: {
  filters: MealFilters;
  lat: number;
  lng: number;
  radiusM: number;
  showDemo: boolean;
  goals: Goals;
  consumed: Totals;
  limit?: number;
}): Promise<SearchResponse> {
  const { filters: f } = args;
  const radius = Math.min(args.radiusM, (f.maxDistanceKm ?? 99) * 1000);
  const found = await discover(args.lat, args.lng, radius, { showDemo: args.showDemo });
  const withMenus = found.restaurants.filter((r) => r.menuCount > 0);
  const meals = await mealViews({ restaurantIds: withMenus.map((r) => r.id) });
  const remaining = Math.max(0, args.goals.kcalTarget - args.consumed.kcal);

  const results: MealResult[] = [];
  for (const meal of meals) {
    const r = withMenus.find((x) => x.id === meal.restaurant.id)!;
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
    ? found.restaurants
        .filter((r) => r.menuCount === 0 && matchesText(`${r.name} ${r.cuisines.join(" ")}`, f.text))
        .slice(0, 8)
        .map(({ id, name, cuisines, distanceM }) => ({ id, name, cuisines, distanceM }))
    : [];

  return {
    results: results.slice(0, args.limit ?? 60),
    noMenuMatches,
    scanned: { restaurants: found.restaurants.length, withMenus: withMenus.length, meals: meals.length },
    liveError: found.liveError,
    pending: found.pending,
  };
}
