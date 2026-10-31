import type { RestaurantTags } from "@/server/db/schema";
import type { PlaceInput } from "@/server/places/types";

/** Shared by the server provider and the browser-only (static) build. */
export const DEFAULT_OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function overpassQuery(lat: number, lng: number, radiusM: number): string {
  return `[out:json][timeout:50];nwr["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)$"]["name"](around:${Math.round(radiusM)},${lat},${lng});out center tags;`;
}

const diet = (v?: string): RestaurantTags["vegan"] => (v === "yes" || v === "only" || v === "no" ? v : undefined);

export function osmElementToPlace(e: OverpassElement): PlaceInput | null {
  const t = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (!t.name || lat == null || lng == null) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  const address = [street, t["addr:city"]].filter(Boolean).join(", ") || null;
  const tags: RestaurantTags = {
    website: t.website || t["contact:website"] || undefined,
    phone: t.phone || t["contact:phone"] || undefined,
    openingHours: t.opening_hours || undefined,
    vegetarian: diet(t["diet:vegetarian"]),
    vegan: diet(t["diet:vegan"]),
    halal: diet(t["diet:halal"]),
    takeaway: t.takeaway === "yes" || t.takeaway === "only" ? true : undefined,
  };
  return {
    provider: "osm",
    providerId: `${e.type}/${e.id}`,
    name: t.name,
    lat,
    lng,
    address,
    cuisines: (t.cuisine ?? "").split(";").map((s) => s.trim().toLowerCase()).filter(Boolean),
    amenity: t.amenity ?? null,
    tags: Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== undefined)) as RestaurantTags,
  };
}

/** Tries each endpoint in turn; the public Overpass servers are sometimes slow or overloaded. */
export async function fetchOverpass(endpoints: string[], query: string, headers: Record<string, string> = {}): Promise<PlaceInput[]> {
  let lastErr: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const json = (await res.json()) as { elements: OverpassElement[] };
      return json.elements.map(osmElementToPlace).filter((p): p is PlaceInput => p !== null);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");
}
