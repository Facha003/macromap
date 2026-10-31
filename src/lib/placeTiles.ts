import type { RestaurantTags } from "@/server/db/schema";

/** Tile size in degrees: ~5.5 km north–south, ~5.5 km east–west at Oslo's latitude. */
export const TILE_LAT = 0.05;
export const TILE_LNG = 0.1;

/** [osm id ("node/123"), name, lat, lng, cuisines, amenity, address, tags] */
export type PlaceTileRow = [string, string, number, number, string[], string | null, string | null, RestaurantTags];

export interface PlacesIndex {
  generatedAt: string;
  country: string;
  attribution: string;
  tileLat: number;
  tileLng: number;
  /** [minLat, minLng, maxLat, maxLng] */
  bbox: [number, number, number, number];
  /** tile key → number of places */
  tiles: Record<string, number>;
}

/** Compact Norway-wide name index for restaurant search: [osm id, name, lat, lng, cuisines, amenity, diet:halal] */
export type PlaceSearchRow = [string, string, number, number, string[], string | null, string | null];

export function tileKey(lat: number, lng: number): string {
  return `${Math.floor(lat / TILE_LAT)}_${Math.floor(lng / TILE_LNG)}`;
}

/** Tile keys covering a circle (approximated by its bounding box). */
export function tilesForRadius(lat: number, lng: number, radiusM: number): string[] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const keys: string[] = [];
  for (let a = Math.floor((lat - dLat) / TILE_LAT); a <= Math.floor((lat + dLat) / TILE_LAT); a++) {
    for (let b = Math.floor((lng - dLng) / TILE_LNG); b <= Math.floor((lng + dLng) / TILE_LNG); b++) keys.push(`${a}_${b}`);
  }
  return keys;
}
