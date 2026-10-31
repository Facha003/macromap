"use client";
/**
 * Browser-only backend for the static (GitHub Pages) build. Restaurants come
 * straight from OpenStreetMap, nutrition is computed with the same shared
 * engine, and personal data (diary, goals, saved items) stays in this browser.
 */
import demo from "../../../data/demo/oslo.json";
import { haversineM } from "@/lib/geo";
import { shiftDay, todayISO } from "@/lib/format";
import { resolveBasis, templateBasis, type EstimateBasis } from "@/lib/nutrition/basis";
import type { Selections } from "@/lib/nutrition/customize";
import { FOOD_ATTRIBUTION, FOODS_RETRIEVED_AT } from "@/lib/nutrition/estimate";
import { buildPrompt, extractJson, interpretationToBasis } from "@/lib/nutrition/llm";
import { DEFAULT_OVERPASS_ENDPOINTS, fetchOverpass, overpassQuery } from "@/lib/osm";
import { parseMealQuery } from "@/lib/queryParser";
import type { GoalType } from "@/lib/scoring";
import { filtersFromParams, rankMeals } from "@/lib/searchCore";
import type { RestaurantTags } from "@/server/db/schema";
import type { MealView } from "@/server/repo/menu";
import type { RestaurantCardData } from "@/components/RestaurantCard";
import type { Backend, DiaryData, PlacesResponse, ProfileData } from "./backendTypes";

// ── storage ───────────────────────────────────────────────────────────────
const PREFIX = "mm.v1.";
const mem = new Map<string, unknown>();

function load<T>(key: string, fallback: T): T {
  if (mem.has(key)) return mem.get(key) as T;
  let v = fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) v = JSON.parse(raw) as T;
  } catch {
    /* storage unavailable — fall back to memory for this session */
  }
  mem.set(key, v);
  return v;
}

function save(key: string, v: unknown) {
  mem.set(key, v);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(v));
  } catch {
    /* quota or privacy mode — keep in memory */
  }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// ── data shapes ───────────────────────────────────────────────────────────
interface Place {
  id: string;
  provider: string;
  providerId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  cuisines: string[];
  amenity: string | null;
  tags: RestaurantTags;
  isDemo: boolean;
  seenAt: number;
  pinned?: boolean;
}

interface Item {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  category: string | null;
  priceNok: number | null;
  sourceType: "official" | "community" | "demo";
  statedDiet: { vegetarian?: boolean; vegan?: boolean; halal?: boolean };
  createdAt: string;
}

interface Entry {
  id: string;
  day: string;
  loggedAt: string;
  menuItemId: string | null;
  restaurantId: string | null;
  name: string;
  restaurantName: string | null;
  selections: Selections;
  portion: number;
  status: string;
  provider: string;
  kcal: number;
  kcalMin: number;
  kcalMax: number;
  protein: number;
  proteinMin: number;
  proteinMax: number;
  carbs: number;
  fat: number;
  fiber: number | null;
}

interface Profile {
  goalType: GoalType;
  kcalTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  weightKg: number | null;
  showDemo: boolean;
}

const DEFAULT_PROFILE: Profile = { goalType: "maintain", kcalTarget: 2200, proteinG: 130, carbsG: 250, fatG: 73, weightKg: null, showDemo: true };

// ── demo data (same file the server seeds from) ───────────────────────────
interface DemoRestaurant {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  cuisines: string[];
  amenity: string;
  tags: RestaurantTags;
  items: { name: string; description: string; price: number; category: string; diet?: { vegetarian?: boolean; vegan?: boolean } }[];
}
const DEMO = (demo as { restaurants: DemoRestaurant[] }).restaurants;
const DEMO_PLACES: Place[] = DEMO.map((r) => ({
  id: `demo:${r.slug}`, provider: "demo", providerId: r.slug, name: r.name, lat: r.lat, lng: r.lng, address: r.address,
  cuisines: r.cuisines, amenity: r.amenity, tags: r.tags, isDemo: true, seenAt: 0, pinned: true,
}));
const DEMO_ITEMS: Item[] = DEMO.flatMap((r) =>
  r.items.map((i, n) => ({
    id: `demo:${r.slug}:${n}`, restaurantId: `demo:${r.slug}`, name: i.name, description: i.description, category: i.category,
    priceNok: i.price, sourceType: "demo" as const, statedDiet: i.diet ?? {}, createdAt: "2026-01-01T00:00:00.000Z",
  })),
);

// ── restaurants ───────────────────────────────────────────────────────────
const places = () => load<Record<string, Place>>("places", {});
const allItems = () => [...DEMO_ITEMS, ...load<Item[]>("community", [])];
const profile = () => ({ ...DEFAULT_PROFILE, ...load<Partial<Profile>>("profile", {}) });

function findPlace(id: string): Place | undefined {
  return DEMO_PLACES.find((p) => p.id === id) ?? places()[id];
}

function storePlaces(list: Omit<Place, "id" | "isDemo" | "seenAt">[]) {
  const all = { ...places() };
  const now = Date.now();
  for (const p of list) {
    const id = `${p.provider}:${p.providerId}`;
    all[id] = { ...p, id, isDemo: false, seenAt: now, pinned: all[id]?.pinned };
  }
  // Keep storage bounded: drop the least recently seen unpinned places.
  const entries = Object.values(all);
  if (entries.length > 3000) {
    entries
      .filter((p) => !p.pinned)
      .sort((a, b) => a.seenAt - b.seenAt)
      .slice(0, entries.length - 3000)
      .forEach((p) => delete all[p.id]);
  }
  save("places", all);
}

const RADIUS_STEPS = [500, 1000, 2000, 3000, 5000];
const PLACES_TTL = 24 * 3600_000;
const inflight = new Map<string, Promise<void>>();
const lastError = new Map<string, string>();

function refresh(key: string, lat: number, lng: number, radius: number) {
  let p = inflight.get(key);
  if (!p) {
    p = fetchOverpass(DEFAULT_OVERPASS_ENDPOINTS, overpassQuery(lat, lng, radius))
      .then((list) => {
        storePlaces(list);
        save("placesCache", { ...load<Record<string, number>>("placesCache", {}), [key]: Date.now() });
        lastError.delete(key);
      })
      .catch((e: Error) => {
        lastError.set(key, e.message);
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

// ── nutrition ─────────────────────────────────────────────────────────────
interface AiRecord { hash: string; basis: EstimateBasis; model: string | null }
const textHash = (i: Item) => `${i.name}|${i.description ?? ""}|2`;

function basisFor(item: Item): { basis: EstimateBasis; model: string | null } {
  const ai = load<Record<string, AiRecord>>("ai", {})[item.id];
  if (ai && ai.hash === textHash(item)) return { basis: ai.basis, model: ai.model };
  return { basis: templateBasis(item.name, item.description ?? ""), model: null };
}

function toView(item: Item): MealView | null {
  const r = findPlace(item.restaurantId);
  if (!r) return null;
  const { basis, model } = basisFor(item);
  return {
    id: item.id, name: item.name, description: item.description, category: item.category, priceNok: item.priceNok,
    sourceType: item.sourceType, sourceUrl: null, lastChecked: item.createdAt, statedDiet: item.statedDiet,
    basis, estimatedAt: item.createdAt, model,
    restaurant: { id: r.id, name: r.name, isDemo: r.isDemo, lat: r.lat, lng: r.lng, cuisines: r.cuisines, halal: r.tags.halal === "yes" || r.tags.halal === "only" },
  };
}

const GEMINI_KEY = "geminiKey";
const geminiModel = () => process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-flash-latest";

async function askGemini(item: Item, place: Place): Promise<EstimateBasis | null> {
  const key = load<string>(GEMINI_KEY, "");
  if (!key) return null;
  const { system, user } = buildPrompt({ name: item.name, description: item.description, cuisines: place.cuisines, restaurantName: place.isDemo ? undefined : place.name });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return interpretationToBasis(extractJson(text), "gemini");
}

// ── diary helpers ─────────────────────────────────────────────────────────
const diaryAll = () => load<Entry[]>("diary", []);
const totalsFor = (day: string) =>
  diaryAll()
    .filter((e) => e.day === day)
    .reduce((t, e) => ({ kcal: t.kcal + e.kcal * e.portion, protein: t.protein + e.protein * e.portion, carbs: t.carbs + e.carbs * e.portion, fat: t.fat + e.fat * e.portion }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

function toggleIn<T>(key: string, match: (x: T) => boolean, make: () => T): boolean {
  const list = load<T[]>(key, []);
  const on = !list.some(match);
  save(key, on ? [make(), ...list] : list.filter((x) => !match(x)));
  return on;
}

// ── backend ───────────────────────────────────────────────────────────────
let geocodeQueue: Promise<unknown> = Promise.resolve();

export const backend: Backend = {
  mode: "static",

  async places(lat, lng, radiusM): Promise<PlacesResponse> {
    const radius = RADIUS_STEPS.find((r) => r >= radiusM) ?? 5000;
    const cellLat = Math.round(lat * 200) / 200;
    const cellLng = Math.round(lng * 200) / 200;
    const key = `${cellLat},${cellLng}:${radius}`;
    let pending = false;
    let liveError: string | null = null;
    const fetchedAt = load<Record<string, number>>("placesCache", {})[key];
    if (!fetchedAt || Date.now() - fetchedAt > PLACES_TTL) {
      const p = refresh(key, cellLat, cellLng, radius + 400);
      const settled = await Promise.race([p.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 4000))]);
      pending = !settled;
      const err = lastError.get(key);
      if (settled && err) liveError = `Live restaurant data is temporarily unavailable (${err}). Showing saved results.`;
    }

    const showDemo = profile().showDemo;
    const items = allItems();
    const candidates = [...(showDemo ? DEMO_PLACES : []), ...Object.values(places())]
      .map((r) => ({ r, d: haversineM({ lat, lng }, r) }))
      .filter((x) => x.d <= radius);
    const coverage = (id: string) => {
      const its = items.filter((i) => i.restaurantId === id);
      return { menuCount: its.length, estimatedCount: its.filter((i) => basisFor(i).basis.kind !== "unavailable").length, verifiedCount: 0 };
    };
    const list: RestaurantCardData[] = candidates
      .map(({ r, d }) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, address: r.address, cuisines: r.cuisines, amenity: r.amenity, isDemo: r.isDemo, distanceM: d, tags: r.tags as RestaurantCardData["tags"], ...coverage(r.id) }))
      .sort((a, b) => Number(b.menuCount > 0) - Number(a.menuCount > 0) || a.distanceM - b.distanceM)
      .slice(0, 400)
      .sort((a, b) => a.distanceM - b.distanceM);
    return { restaurants: list, attribution: "© OpenStreetMap contributors (ODbL)", liveError, pending };
  },

  async geocode(q) {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const cache = load<Record<string, { label: string; lat: number; lng: number }[]>>("geocode", {});
    if (cache[query]) return cache[query];
    // Nominatim's usage policy: at most one request per second.
    const run = geocodeQueue.then(async () => {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, { headers: { "accept-language": "en,nb" } });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      return ((await res.json()) as { display_name: string; lat: string; lon: string }[]).map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
    });
    geocodeQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
    const results = await run;
    save("geocode", { ...cache, [query]: results });
    return results;
  },

  async search(p) {
    const filters = filtersFromParams(p, parseMealQuery((p.get("q") ?? "").slice(0, 200)));
    const lat = Number(p.get("lat")) || 59.9139;
    const lng = Number(p.get("lng")) || 10.7522;
    const radius = filters.maxDistanceKm ? filters.maxDistanceKm * 1000 : Math.min(5000, Number(p.get("radius")) || 3000);
    const found = await backend.places(lat, lng, radius);
    const withMenus = new Set(found.restaurants.filter((r) => r.menuCount > 0).map((r) => r.id));
    const meals = allItems().filter((i) => withMenus.has(i.restaurantId)).map(toView).filter((m): m is MealView => m !== null);
    const prof = profile();
    const consumed = totalsFor(todayISO());
    return {
      ...rankMeals({ meals, restaurants: found.restaurants, filters, lat, lng, goals: prof, consumed }),
      scanned: { restaurants: found.restaurants.length, withMenus: withMenus.size, meals: meals.length },
      liveError: found.liveError,
      pending: found.pending,
      filters,
      remainingKcal: Math.max(0, prof.kcalTarget - consumed.kcal),
    };
  },

  async meals(ids) {
    const items = allItems();
    return ids.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i).map(toView).filter((m): m is MealView => m !== null);
  },

  async estimate(itemId, allowAi) {
    const item = allItems().find((i) => i.id === itemId);
    if (!item) throw new Error("Meal not found");
    const current = basisFor(item);
    const isTemplate = current.basis.kind === "unavailable" || ((current.basis.kind === "archetype" || current.basis.kind === "components") && current.basis.provider === "template");
    if (!allowAi || !isTemplate || current.model === "ai-fallback") return { basis: current.basis, aiNote: null };
    if (!load<string>(GEMINI_KEY, "")) return { basis: current.basis, aiNote: "Showing a template estimate. Add a free Gemini key in Profile to analyse any dish with AI." };
    const place = findPlace(item.restaurantId)!;
    try {
      const ai = await askGemini(item, place);
      const template = current.basis;
      const chosen = !ai || (ai.kind === "unavailable" && template.kind === "archetype") ? template : ai;
      save("ai", { ...load<Record<string, AiRecord>>("ai", {}), [item.id]: { hash: textHash(item), basis: chosen, model: chosen === ai ? geminiModel() : "ai-fallback" } });
      return { basis: chosen, aiNote: chosen === ai ? null : "The AI response couldn't be used — showing a template estimate." };
    } catch (e) {
      return { basis: current.basis, aiNote: `AI estimation failed (${(e as Error).message}) — showing a template estimate.` };
    }
  },

  async restaurant(id) {
    const r = findPlace(id);
    if (!r) return null;
    return {
      restaurant: { id: r.id, name: r.name, provider: r.provider, providerId: r.providerId, isDemo: r.isDemo, cuisines: r.cuisines, amenity: r.amenity, address: r.address, tags: r.tags },
      meals: allItems().filter((i) => i.restaurantId === id).map(toView).filter((m): m is MealView => m !== null),
      favoriteIds: load<{ menuItemId: string }[]>("favorites", []).map((f) => f.menuItemId),
      saved: load<{ restaurantId: string }[]>("savedRestaurants", []).some((s) => s.restaurantId === id),
      aiEnabled: Boolean(load<string>(GEMINI_KEY, "")),
    };
  },

  async addDish(restaurantId, input) {
    const place = findPlace(restaurantId);
    if (!place) throw new Error("Restaurant not found");
    if (input.name.trim().length < 2) throw new Error("Please enter a dish name (2–120 characters).");
    if (!place.isDemo) save("places", { ...places(), [place.id]: { ...place, pinned: true } });
    const item: Item = {
      id: `local:${uid()}`, restaurantId, name: input.name.trim().slice(0, 120), description: input.description?.trim().slice(0, 500) || null,
      category: "Added by you", priceNok: input.priceNok, sourceType: "community", statedDiet: {}, createdAt: new Date().toISOString(),
    };
    save("community", [...load<Item[]>("community", []), item]);
    await backend.estimate(item.id, true).catch(() => {});
  },

  async logMeal({ menuItemId, selections, portion, day }) {
    const item = allItems().find((i) => i.id === menuItemId);
    if (!item) throw new Error("Meal not found");
    const { estimate } = resolveBasis(basisFor(item).basis, selections);
    if (!estimate) throw new Error("This meal has no nutrition estimate to log");
    const place = findPlace(item.restaurantId);
    const v = estimate.values;
    save("diary", [
      ...diaryAll(),
      {
        id: uid(), day, loggedAt: new Date().toISOString(), menuItemId, restaurantId: place?.id ?? null, name: item.name, restaurantName: place?.name ?? null,
        selections, portion: Math.min(5, Math.max(0.1, portion)), status: estimate.status, provider: estimate.provider,
        kcal: v.kcal.likely, kcalMin: v.kcal.min, kcalMax: v.kcal.max, protein: v.protein.likely, proteinMin: v.protein.min, proteinMax: v.protein.max,
        carbs: v.carbs.likely, fat: v.fat.likely, fiber: v.fiber?.likely ?? null,
      },
    ]);
    return { kcal: v.kcal.likely * portion };
  },

  async setEntryPortion(id, portion) {
    save("diary", diaryAll().map((e) => (e.id === id ? { ...e, portion: Math.min(5, Math.max(0.1, portion)) } : e)));
  },

  async deleteEntry(id) {
    save("diary", diaryAll().filter((e) => e.id !== id));
  },

  async repeatEntry(id, day) {
    const e = diaryAll().find((x) => x.id === id);
    if (e) save("diary", [...diaryAll(), { ...e, id: uid(), day: day ?? todayISO(), loggedAt: new Date().toISOString() }]);
  },

  async toggleFavorite(menuItemId, selections) {
    return toggleIn<{ menuItemId: string; selections: Selections; createdAt: string }>("favorites", (f) => f.menuItemId === menuItemId, () => ({ menuItemId, selections, createdAt: new Date().toISOString() }));
  },

  async toggleSavedRestaurant(restaurantId) {
    const place = findPlace(restaurantId);
    if (place && !place.isDemo) save("places", { ...places(), [place.id]: { ...place, pinned: true } });
    return toggleIn<{ restaurantId: string; createdAt: string }>("savedRestaurants", (s) => s.restaurantId === restaurantId, () => ({ restaurantId, createdAt: new Date().toISOString() }));
  },

  async diary(requested): Promise<DiaryData> {
    const today = todayISO();
    const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
    const all = diaryAll();
    const seen = new Set<string>();
    const recent = [...all]
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
      .filter((e) => {
        const k = `${e.menuItemId ?? e.name}|${JSON.stringify(e.selections)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8);
    const p = profile();
    return {
      day,
      today,
      goals: { goalType: p.goalType, kcalTarget: p.kcalTarget, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG },
      entries: all.filter((e) => e.day === day).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
      recent: recent.map((e) => ({ id: e.id, name: e.name, restaurantName: e.restaurantName, kcal: e.kcal * e.portion, protein: e.protein * e.portion })),
      week: Array.from({ length: 7 }, (_, i) => shiftDay(day, i - 6)).map((d) => ({ day: d, kcal: totalsFor(d).kcal })),
    };
  },

  async saved() {
    const favs = load<{ menuItemId: string; selections: Selections }[]>("favorites", []);
    const meals = await backend.meals(favs.map((f) => f.menuItemId));
    return {
      favorites: favs.flatMap((f) => {
        const meal = meals.find((m) => m.id === f.menuItemId);
        return meal ? [{ meal, selections: f.selections }] : [];
      }),
      restaurants: load<{ restaurantId: string }[]>("savedRestaurants", [])
        .map((s) => findPlace(s.restaurantId))
        .filter((r): r is Place => !!r)
        .map((r) => ({ id: r.id, name: r.name, cuisines: r.cuisines, isDemo: r.isDemo, address: r.address })),
    };
  },

  async profile(): Promise<ProfileData> {
    const key = load<string>(GEMINI_KEY, "");
    return {
      profile: profile(),
      account: { kind: "browser", email: null, supabase: false },
      system: { ai: key ? `gemini · ${geminiModel()} (your key)` : null, places: "© OpenStreetMap contributors (ODbL)", foods: Object.values(FOOD_ATTRIBUTION), foodsRetrievedAt: FOODS_RETRIEVED_AT },
    };
  },

  async saveGoals(g) {
    save("profile", { ...profile(), ...g });
  },

  async setShowDemo(show) {
    save("profile", { ...profile(), showDemo: show });
  },

  async exportData() {
    return {
      exportedAt: new Date().toISOString(),
      profile: profile(),
      diary: diaryAll(),
      favorites: load("favorites", []),
      savedRestaurants: load("savedRestaurants", []),
      addedDishes: load("community", []),
    };
  },

  async deleteMyData() {
    for (const k of ["profile", "diary", "favorites", "savedRestaurants", "community", "ai", GEMINI_KEY]) {
      mem.delete(k);
      try {
        localStorage.removeItem(PREFIX + k);
      } catch {
        /* ignore */
      }
    }
  },

  async signIn() {
    return { ok: false, error: "Accounts aren't available in the GitHub Pages version." };
  },

  async signOut() {},

  aiKey: {
    get: () => load<string>(GEMINI_KEY, ""),
    set: (key: string) => save(GEMINI_KEY, key.trim()),
  },
};

