import type { RestaurantTags } from "../db/schema";

/** Normalised place from any provider, before it is stored. */
export interface PlaceInput {
  provider: "osm" | "google";
  providerId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  cuisines: string[];
  amenity: string | null;
  tags: RestaurantTags;
}

export interface PlacesProvider {
  id: "osm" | "google";
  attribution: string;
  nearby(lat: number, lng: number, radiusM: number): Promise<PlaceInput[]>;
}
