import type { Selections } from "@/lib/nutrition/customize";
import type { EstimateBasis } from "@/lib/nutrition/basis";
import type { MealFilters } from "@/lib/queryParser";
import type { GoalType, Goals } from "@/lib/scoring";
import type { SearchResponse } from "@/lib/searchCore";
import type { RestaurantTags } from "@/server/db/schema";
import type { MealView } from "@/server/repo/menu";
import type { RestaurantCardData } from "@/components/RestaurantCard";

export interface PlacesResponse {
  restaurants: RestaurantCardData[];
  attribution: string;
  liveError: string | null;
  pending: boolean;
}

export interface RestaurantPageData {
  restaurant: { id: string; name: string; provider: string; providerId: string; isDemo: boolean; cuisines: string[]; amenity: string | null; address: string | null; tags: RestaurantTags };
  meals: MealView[];
  favoriteIds: string[];
  saved: boolean;
  aiEnabled: boolean;
}

export interface DiaryEntryView {
  id: string;
  name: string;
  restaurantName: string | null;
  portion: number;
  status: string;
  provider: string;
  kcal: number;
  kcalMin: number;
  kcalMax: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt: string;
}

export interface DiaryData {
  day: string;
  today: string;
  goals: Goals;
  entries: DiaryEntryView[];
  recent: { id: string; name: string; restaurantName: string | null; kcal: number; protein: number }[];
  week: { day: string; kcal: number }[];
}

export interface SavedData {
  favorites: { meal: MealView; selections: Selections }[];
  restaurants: { id: string; name: string; cuisines: string[]; isDemo: boolean; address: string | null }[];
}

export interface ProfileData {
  profile: { goalType: GoalType; kcalTarget: number; proteinG: number; carbsG: number; fatG: number; weightKg: number | null; showDemo: boolean };
  account: { kind: string; email: string | null; supabase: boolean };
  system: { ai: string | null; places: string; foods: string[]; foodsRetrievedAt: string };
}

export type SearchApiResponse = SearchResponse & { filters: MealFilters; remainingKcal: number };

export interface Backend {
  /** "server": Next.js server + database. "static": everything in the browser (GitHub Pages). */
  mode: "server" | "static";
  places(lat: number, lng: number, radiusM: number): Promise<PlacesResponse>;
  geocode(q: string): Promise<{ label: string; lat: number; lng: number }[]>;
  search(params: URLSearchParams): Promise<SearchApiResponse>;
  meals(ids: string[]): Promise<MealView[]>;
  estimate(itemId: string, allowAi: boolean): Promise<{ basis: EstimateBasis; aiNote: string | null }>;
  restaurant(id: string): Promise<RestaurantPageData | null>;
  addDish(restaurantId: string, input: { name: string; description?: string; priceNok: number | null }): Promise<void>;
  /** Bulk import from a pasted menu; estimates run lazily when each dish is opened. */
  addDishes(restaurantId: string, items: { name: string; description: string | null; priceNok: number | null }[]): Promise<number>;
  logMeal(input: { menuItemId: string; selections: Selections; portion: number; day: string }): Promise<{ kcal: number }>;
  setEntryPortion(id: string, portion: number): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  repeatEntry(id: string, day?: string): Promise<void>;
  toggleFavorite(menuItemId: string, selections: Selections): Promise<boolean>;
  toggleSavedRestaurant(restaurantId: string): Promise<boolean>;
  diary(day: string | null): Promise<DiaryData>;
  saved(): Promise<SavedData>;
  profile(): Promise<ProfileData>;
  saveGoals(g: ProfileData["profile"]): Promise<void>;
  setShowDemo(show: boolean): Promise<void>;
  exportData(): Promise<unknown>;
  deleteMyData(): Promise<void>;
  signIn(email: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
  /** Static mode only: a personal Gemini key stored in this browser. */
  aiKey?: { get(): string; set(key: string): void };
}
