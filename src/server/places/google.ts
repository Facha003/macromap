import "server-only";
import type { PlacesProvider } from "./types";

/**
 * Google Places API (New) — Nearby Search. Requires a billed key
 * (GOOGLE_PLACES_API_KEY). Google's terms allow storing place IDs indefinitely
 * but other content only for limited periods; the 24 h api_cache TTL and the
 * restaurants table refresh on every lookup keep within that.
 */
export function googleProvider(key: string): PlacesProvider {
  return {
    id: "google",
    attribution: "Places data © Google",
    async nearby(lat, lng, radiusM) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
          "x-goog-fieldmask": "places.id,places.displayName,places.location,places.shortFormattedAddress,places.primaryType,places.types,places.websiteUri,places.servesVegetarianFood",
        },
        body: JSON.stringify({
          includedTypes: ["restaurant", "cafe", "fast_food_restaurant"],
          maxResultCount: 20,
          rankPreference: "DISTANCE",
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusM, 50_000) } },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
      const json = (await res.json()) as {
        places?: {
          id: string;
          displayName?: { text: string };
          location: { latitude: number; longitude: number };
          shortFormattedAddress?: string;
          primaryType?: string;
          types?: string[];
          websiteUri?: string;
          servesVegetarianFood?: boolean;
        }[];
      };
      return (json.places ?? []).map((p) => ({
        provider: "google" as const,
        providerId: p.id,
        name: p.displayName?.text ?? "Unnamed",
        lat: p.location.latitude,
        lng: p.location.longitude,
        address: p.shortFormattedAddress ?? null,
        cuisines: (p.types ?? []).filter((t) => t.endsWith("_restaurant") && t !== "fast_food_restaurant").map((t) => t.replace("_restaurant", "")),
        amenity: p.primaryType?.includes("cafe") ? "cafe" : p.primaryType?.includes("fast_food") ? "fast_food" : "restaurant",
        tags: { website: p.websiteUri, vegetarian: p.servesVegetarianFood ? "yes" : undefined },
      }));
    },
  };
}
