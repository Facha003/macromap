import "server-only";
import { DEFAULT_OVERPASS_ENDPOINTS, fetchOverpass, overpassQuery } from "@/lib/osm";
import type { PlacesProvider } from "./types";
import { osmUserAgent } from "./userAgent";

const ENDPOINTS = process.env.OVERPASS_URLS ? process.env.OVERPASS_URLS.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_OVERPASS_ENDPOINTS;

/** OpenStreetMap via the Overpass API — free, ODbL licensed, attribution required. */
export const osmProvider: PlacesProvider = {
  id: "osm",
  attribution: "© OpenStreetMap contributors (ODbL)",
  nearby: (lat, lng, radiusM) => fetchOverpass(ENDPOINTS, overpassQuery(lat, lng, radiusM), { "user-agent": osmUserAgent() }),
};
