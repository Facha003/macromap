import { NextResponse } from "next/server";
import { OSLO } from "@/lib/geo";
import { todayISO } from "@/lib/format";
import { parseMealQuery } from "@/lib/queryParser";
import { filtersFromParams } from "@/lib/searchCore";
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
  const filters = filtersFromParams(p, parsed);
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
