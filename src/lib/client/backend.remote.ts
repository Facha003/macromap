"use client";
import * as actions from "@/app/actions";
import type { FoundMenu } from "@/lib/menuFinder";
import type { Backend, PlacesResponse, RestaurantHit, SearchApiResponse } from "./backendTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json<T = any>(res: Response): Promise<T> {
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j as T;
}

/** Talks to the Next.js server (API routes + server actions). */
export const backend: Backend = {
  mode: "server",
  places: (lat, lng, r) => fetch(`/api/places?lat=${lat}&lng=${lng}&radius=${r}`).then((res) => json<PlacesResponse>(res)),
  geocode: async (q) => (await json<{ results: { label: string; lat: number; lng: number }[] }>(await fetch(`/api/geocode?q=${encodeURIComponent(q)}`))).results,
  search: (p) => fetch(`/api/search?${p}`).then((res) => json<SearchApiResponse>(res)),
  searchRestaurants: async (q, lat, lng) =>
    (await json<{ results: RestaurantHit[] }>(await fetch(`/api/restaurants/search?q=${encodeURIComponent(q)}&lat=${lat}&lng=${lng}`))).results,
  findMenu: async (id) => json<FoundMenu>(await fetch(`/api/restaurants/${encodeURIComponent(id)}/find-menu`, { method: "POST" })),
  meals: async (ids) => (ids.length ? (await json<{ meals: never[] }>(await fetch(`/api/items?ids=${ids.map(encodeURIComponent).join(",")}`))).meals : []),
  estimate: (id, ai) => fetch(`/api/items/${encodeURIComponent(id)}/estimate${ai ? "?ai=1" : ""}`).then((res) => json(res)),
  restaurant: (id) => actions.getRestaurantPage(id),
  addDish: async (rid, input) => {
    await json(await fetch(`/api/restaurants/${encodeURIComponent(rid)}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
  },
  addDishes: async (rid, items) =>
    (await json<{ added: number }>(await fetch(`/api/restaurants/${encodeURIComponent(rid)}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) }))).added,
  logMeal: (i) => actions.logMeal(i),
  setEntryPortion: (id, p) => actions.setEntryPortion(id, p),
  deleteEntry: (id) => actions.deleteEntryAction(id),
  repeatEntry: (id, day) => actions.repeatEntry(id, day),
  toggleFavorite: (id, sel) => actions.toggleFavoriteAction(id, sel),
  toggleSavedRestaurant: (id) => actions.toggleSavedRestaurantAction(id),
  diary: (day) => actions.getDiary(day),
  saved: () => actions.getSaved(),
  profile: () => actions.getProfilePage(),
  saveGoals: async (g) => {
    await actions.saveGoals(g);
  },
  setShowDemo: (b) => actions.setShowDemo(b),
  exportData: () => fetch("/api/export").then((r) => r.json()),
  deleteMyData: () => actions.deleteMyData(),
  signIn: (email) => actions.signInWithEmail(email),
  signOut: () => actions.signOut(),
};
