import "server-only";
import { and, between, eq, inArray, sql } from "drizzle-orm";
import { boundingBox, haversineM } from "@/lib/geo";
import { after } from "next/server";
import { readCache, writeCache } from "../cache";
import { getDb } from "../db";
import { menuItems, nutritionRecords, restaurants } from "../db/schema";
import { ensureEstimates } from "../nutrition/service";
import { googleProvider } from "./google";
import { osmProvider } from "./osm";
import type { PlaceInput, PlacesProvider } from "./types";

export interface RestaurantSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  cuisines: string[];
  amenity: string | null;
  isDemo: boolean;
  provider: string;
  tags: typeof restaurants.$inferSelect.tags;
  distanceM: number;
  menuCount: number;
  estimatedCount: number;
  verifiedCount: number;
}

export function placesProvider(): PlacesProvider {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return process.env.PLACES_PROVIDER !== "osm" && key ? googleProvider(key) : osmProvider;
}

const RADIUS_STEPS = [500, 1000, 2000, 3000, 5000];
export const MAX_RADIUS_M = 5000;

async function storePlaces(places: PlaceInput[]) {
  if (!places.length) return;
  const db = await getDb();
  for (let i = 0; i < places.length; i += 200) {
    const chunk = places.slice(i, i + 200).map((p) => ({ id: `${p.provider}:${p.providerId}`, ...p, updatedAt: new Date() }));
    await db
      .insert(restaurants)
      .values(chunk)
      .onConflictDoUpdate({
        target: restaurants.id,
        set: {
          name: sql`excluded.name`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          address: sql`excluded.address`,
          cuisines: sql`excluded.cuisines`,
          amenity: sql`excluded.amenity`,
          tags: sql`excluded.tags`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}

export interface DiscoverResult {
  restaurants: RestaurantSummary[];
  attribution: string;
  liveError: string | null;
  /** True while a slow live lookup is still running; the client should poll. */
  pending: boolean;
}

const inflight = new Map<string, Promise<void>>();
const lastError = new Map<string, string>();
const PLACES_TTL = 24 * 3600_000;

function refresh(key: string, provider: PlacesProvider, lat: number, lng: number, radius: number): Promise<void> {
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      try {
        const places = await provider.nearby(lat, lng, radius);
        await storePlaces(places);
        await writeCache(key, { count: places.length });
        lastError.delete(key);
      } catch (e) {
        lastError.set(key, (e as Error).message);
        throw e;
      } finally {
        inflight.delete(key);
      }
    })();
    p.catch(() => {});
    inflight.set(key, p);
  }
  return p;
}

/**
 * Finds restaurants near a point. Live places come from the configured provider
 * (cached 24 h per ~500 m cell) and are fetched in the background so a slow
 * provider never blocks the page; demo and community restaurants come from the DB.
 */
export async function discover(lat: number, lng: number, radiusM: number, opts: { showDemo: boolean; waitMs?: number }): Promise<DiscoverResult> {
  const radius = RADIUS_STEPS.find((r) => r >= radiusM) ?? MAX_RADIUS_M;
  const provider = placesProvider();
  const cellLat = Math.round(lat * 200) / 200;
  const cellLng = Math.round(lng * 200) / 200;
  const key = `places:${provider.id}:${cellLat},${cellLng}:${radius}`;
  let pending = false;
  let liveError: string | null = null;

  if (!(await readCache(key, PLACES_TTL))) {
    const p = refresh(key, provider, cellLat, cellLng, radius + 400);
    try {
      after(() => p.catch(() => {})); // keeps serverless functions alive until the lookup finishes
    } catch {
      /* outside a request scope (scripts/tests) */
    }
    const settled = await Promise.race([p.then(() => true, () => true), new Promise<false>((r) => setTimeout(() => r(false), opts.waitMs ?? 4000))]);
    pending = !settled;
    const err = lastError.get(key);
    if (settled && err) liveError = `Live restaurant data is temporarily unavailable (${err}). Showing saved results.`;
  }

  const db = await getDb();
  const box = boundingBox({ lat, lng }, radius);
  const rows = await db
    .select()
    .from(restaurants)
    .where(
      and(
        between(restaurants.lat, box.minLat, box.maxLat),
        between(restaurants.lng, box.minLng, box.maxLng),
        opts.showDemo ? undefined : eq(restaurants.isDemo, false),
      ),
    );

  const inRadius = rows.map((r) => ({ r, d: haversineM({ lat, lng }, r) })).filter((x) => x.d <= radius);
  const coverage = await menuCoverage(inRadius.map((x) => x.r.id));
  // Cap the list size, but never drop a restaurant we have nutrition data for.
  const withDist = inRadius
    .sort((a, b) => Number(coverage.has(b.r.id)) - Number(coverage.has(a.r.id)) || a.d - b.d)
    .slice(0, 400)
    .sort((a, b) => a.d - b.d);

  return {
    attribution: provider.attribution,
    liveError,
    pending,
    restaurants: withDist.map(({ r, d }) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      cuisines: r.cuisines,
      amenity: r.amenity,
      isDemo: r.isDemo,
      provider: r.provider,
      tags: r.tags,
      distanceM: d,
      ...(coverage.get(r.id) ?? { menuCount: 0, estimatedCount: 0, verifiedCount: 0 }),
    })),
  };
}

async function menuCoverage(restaurantIds: string[]) {
  const out = new Map<string, { menuCount: number; estimatedCount: number; verifiedCount: number }>();
  if (!restaurantIds.length) return out;
  const db = await getDb();
  const items: { id: string; restaurantId: string }[] = [];
  for (let i = 0; i < restaurantIds.length; i += 1000) {
    items.push(...(await db.select({ id: menuItems.id, restaurantId: menuItems.restaurantId }).from(menuItems).where(inArray(menuItems.restaurantId, restaurantIds.slice(i, i + 1000)))));
  }
  if (!items.length) return out;
  await ensureEstimates(items.map((i) => i.id));
  const recs = await db
    .selectDistinctOn([nutritionRecords.menuItemId], { menuItemId: nutritionRecords.menuItemId, status: nutritionRecords.status, basis: nutritionRecords.basis })
    .from(nutritionRecords)
    .where(inArray(nutritionRecords.menuItemId, items.map((i) => i.id)))
    .orderBy(nutritionRecords.menuItemId, sql`${nutritionRecords.createdAt} desc`);
  const recBy = new Map(recs.map((r) => [r.menuItemId, r]));
  for (const i of items) {
    const c = out.get(i.restaurantId) ?? { menuCount: 0, estimatedCount: 0, verifiedCount: 0 };
    c.menuCount++;
    const rec = recBy.get(i.id);
    if (rec && rec.basis.kind !== "unavailable") {
      if (rec.status === "verified") c.verifiedCount++;
      else c.estimatedCount++;
    }
    out.set(i.restaurantId, c);
  }
  return out;
}
