import { NextResponse } from "next/server";
import { OSLO } from "@/lib/geo";
import { todayISO } from "@/lib/format";
import { parseMealQuery, type MealFilters } from "@/lib/queryParser";
import { getSession } from "@/server/auth";
import { MAX_RADIUS_M } from "@/server/places";
import { getProfile, listDay, totalsOf } from "@/server/repo/user";
import { searchMeals } from "@/server/search";
import { fail, limited, num } from "../_util";

export async function GET(req: Request) {
  const blocked = limited(req, "search", 40);
  if (blocked) return blocked;
  const p = new URL(req.url).searchParams;
  const parsed = parseMealQuery((p.get("q") ?? "").slice(0, 200));
  const flag = (k: string) => (p.get(k) === "1" ? true : p.get(k) === "0" ? false : undefined);
  const filters: MealFilters = {
    ...parsed,
    // 0 = explicitly cleared
    maxKcal: p.has("maxKcal") ? num(p.get("maxKcal"), 0, 0, 5000) || undefined : parsed.maxKcal,
    minProtein: p.has("minProtein") ? num(p.get("minProtein"), 0, 0, 300) : parsed.minProtein,
    maxDistanceKm: p.has("km") ? num(p.get("km"), 2, 0.2, 5) : parsed.maxDistanceKm,
    vegetarian: flag("vegetarian") ?? parsed.vegetarian,
    vegan: flag("vegan") ?? parsed.vegan,
    halal: flag("halal") ?? parsed.halal,
    withinBudget: flag("budget") ?? parsed.withinBudget,
    sort: (["score", "protein_density", "kcal", "distance", "protein"] as const).find((s) => s === p.get("sort")) ?? parsed.sort,
  };
  try {
    const { userId } = await getSession();
    const profile = await getProfile(userId);
    const consumed = totalsOf(await listDay(userId, p.get("day") ?? todayISO()));
    const data = await searchMeals({
      filters,
      lat: num(p.get("lat"), OSLO.lat, -90, 90),
      lng: num(p.get("lng"), OSLO.lng, -180, 180),
      radiusM: filters.maxDistanceKm ? filters.maxDistanceKm * 1000 : num(p.get("radius"), 3000, 200, MAX_RADIUS_M),
      showDemo: profile.showDemo,
      goals: profile,
      consumed,
    });
    return NextResponse.json({ ...data, filters, remainingKcal: Math.max(0, profile.kcalTarget - consumed.kcal) });
  } catch (e) {
    return fail(e);
  }
}
