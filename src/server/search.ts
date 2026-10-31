import "server-only";
import type { MealFilters } from "@/lib/queryParser";
import { rankMeals, type SearchResponse } from "@/lib/searchCore";
import type { Goals, Totals } from "@/lib/scoring";
import { discover } from "./places";
import { mealViews, typicalViews, websiteViews } from "./repo/menu";

export type { MealResult, SearchResponse } from "@/lib/searchCore";

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
  const radius = Math.min(args.radiusM, (args.filters.maxDistanceKm ?? 99) * 1000);
  const found = await discover(args.lat, args.lng, radius, { showDemo: args.showDemo });
  const withMenus = found.restaurants.filter((r) => r.menuCount > 0);
  // Real menus where we have them, typical dishes for every other restaurant.
  const meals = [
    ...(await mealViews({ restaurantIds: withMenus.map((r) => r.id) })),
    ...found.restaurants.filter((r) => r.menuCount === 0).flatMap((r) => {
      const web = websiteViews(r);
      return web.length ? web : typicalViews(r);
    }),
  ];
  return {
    ...rankMeals({ ...args, meals, restaurants: found.restaurants }),
    scanned: { restaurants: found.restaurants.length, withMenus: withMenus.length, meals: meals.length },
    liveError: found.liveError,
    pending: found.pending,
  };
}
