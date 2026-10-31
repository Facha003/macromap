import { NextResponse } from "next/server";
import { ilike, or } from "drizzle-orm";
import { haversineM, OSLO } from "@/lib/geo";
import { getDb } from "@/server/db";
import { restaurants } from "@/server/db/schema";
import { fail, limited, num } from "../../_util";

/** Restaurant name search over every place the server has seen (cached OSM areas + demo). */
export async function GET(req: Request) {
  const blocked = limited(req, "restaurant-search", 60);
  if (blocked) return blocked;
  const p = new URL(req.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const lat = num(p.get("lat"), OSLO.lat, -90, 90);
  const lng = num(p.get("lng"), OSLO.lng, -180, 180);
  try {
    const db = await getDb();
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const rows = await db.select().from(restaurants).where(or(ilike(restaurants.name, like))).limit(500);
    const results = rows
      .map((r) => ({ id: r.id, name: r.name, cuisines: r.cuisines, amenity: r.amenity, lat: r.lat, lng: r.lng, distanceM: haversineM({ lat, lng }, r), halalTag: r.tags.halal ?? null }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 50);
    return NextResponse.json({ results });
  } catch (e) {
    return fail(e);
  }
}
