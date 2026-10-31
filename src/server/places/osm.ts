import "server-only";
import type { RestaurantTags } from "../db/schema";
import type { PlaceInput, PlacesProvider } from "./types";
import { osmUserAgent } from "./userAgent";

const ENDPOINTS = (process.env.OVERPASS_URLS || "https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter").split(",").map((s) => s.trim()).filter(Boolean);

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const diet = (v?: string): RestaurantTags["vegan"] =>
  v === "yes" || v === "only" || v === "no" ? v : undefined;

function toPlace(e: OverpassElement): PlaceInput | null {
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

/** OpenStreetMap via the Overpass API — free, ODbL licensed, attribution required. */
export const osmProvider: PlacesProvider = {
  id: "osm",
  attribution: "© OpenStreetMap contributors (ODbL)",
  async nearby(lat, lng, radiusM) {
    const q = `[out:json][timeout:50];nwr["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)$"]["name"](around:${Math.round(radiusM)},${lat},${lng});out center tags;`;
    let json: { elements: OverpassElement[] } | null = null;
    let lastErr: unknown = null;
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": osmUserAgent() },
          body: `data=${encodeURIComponent(q)}`,
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        json = (await res.json()) as { elements: OverpassElement[] };
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!json) throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");
    return json.elements.map(toPlace).filter((p): p is PlaceInput => p !== null);
  },
};
