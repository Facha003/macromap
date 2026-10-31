/**
 * Builds a static, tiled snapshot of every restaurant / café / fast-food place
 * in a country from OpenStreetMap, for instant lookups in the GitHub Pages build.
 *
 *   npm run places:build            # Norway (default)
 *   PLACES_COUNTRY=SE npm run places:build
 *
 * One Overpass query per build (run daily by the Pages workflow) instead of one
 * per visitor — faster for users and gentler on the free OSM infrastructure.
 * Output: public/places/index.json + public/places/<tile>.json
 * Data © OpenStreetMap contributors, ODbL.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { osmElementToPlace, type OverpassElement } from "../src/lib/osm";
import { TILE_LAT, TILE_LNG, tileKey, type PlaceTileRow, type PlacesIndex } from "../src/lib/placeTiles";

const COUNTRY = process.env.PLACES_COUNTRY || "NO";
const ENDPOINTS = ["https://lz4.overpass-api.de/api/interpreter", "https://z.overpass-api.de/api/interpreter", "https://overpass-api.de/api/interpreter"];
const OUT = join(process.cwd(), "public", "places");

async function fetchCountry(): Promise<OverpassElement[]> {
  const q = `[out:json][timeout:600][maxsize:536870912];area["ISO3166-1"="${COUNTRY}"][admin_level=2]->.c;nwr["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)$"]["name"](area.c);out center tags;`;
  let lastErr: unknown;
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`Querying ${endpoint} for ${COUNTRY}…`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "MacroMap/0.1 (daily static extract; https://github.com/Facha003/macromap)" },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(660_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { elements: OverpassElement[] }).elements;
    } catch (e) {
      lastErr = e;
      console.warn(`  failed: ${(e as Error).message}`);
    }
  }
  throw lastErr;
}

async function main() {
  // PLACES_INPUT=<file.json> reuses a saved Overpass response (for local testing).
  const elements = process.env.PLACES_INPUT
    ? (JSON.parse(readFileSync(process.env.PLACES_INPUT, "utf8")) as { elements: OverpassElement[] }).elements
    : await fetchCountry();
  const tiles = new Map<string, PlaceTileRow[]>();
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const e of elements) {
    const p = osmElementToPlace(e);
    if (!p) continue;
    const key = tileKey(p.lat, p.lng);
    const row: PlaceTileRow = [p.providerId, p.name, +p.lat.toFixed(6), +p.lng.toFixed(6), p.cuisines, p.amenity, p.address, p.tags];
    (tiles.get(key) ?? tiles.set(key, []).get(key)!).push(row);
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const [key, rows] of tiles) writeFileSync(join(OUT, `${key}.json`), JSON.stringify(rows));
  const index: PlacesIndex = {
    generatedAt: new Date().toISOString(),
    country: COUNTRY,
    attribution: "© OpenStreetMap contributors (ODbL)",
    tileLat: TILE_LAT,
    tileLng: TILE_LNG,
    bbox: [minLat, minLng, maxLat, maxLng],
    tiles: Object.fromEntries([...tiles].map(([k, v]) => [k, v.length])),
  };
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index));
  const total = [...tiles.values()].reduce((s, t) => s + t.length, 0);
  console.log(`Wrote ${total} places in ${tiles.size} tiles to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
