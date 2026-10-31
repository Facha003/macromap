"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { resolveBasis } from "@/lib/nutrition/basis";
import { shiftDay, todayISO } from "@/lib/format";
import type { DiaryData, ProfileData, RestaurantPageData, SavedData } from "@/lib/client/backendTypes";
import { FOOD_ATTRIBUTION, FOODS_RETRIEVED_AT } from "@/lib/nutrition/estimate";
import { getLlmProvider } from "@/server/nutrition/llm/providers";
import { placesProvider } from "@/server/places";
import { getSession, supabaseConfigured, supabaseServer } from "@/server/auth";
import { getItemBasis } from "@/server/nutrition/service";
import { deleteOwnDishes, getMenuItem, getRestaurant, mealViews, typicalViewById, typicalViews } from "@/server/repo/menu";
import { parseTypicalId } from "@/lib/typicalDishes";
import { templateBasis } from "@/lib/nutrition/basis";
import * as repo from "@/server/repo/user";

const selectionsSchema = z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number()])).default({});
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function logMeal(input: { menuItemId: string; selections: unknown; portion: number; day?: string }) {
  const { userId } = await getSession();
  const selections = selectionsSchema.parse(input.selections);
  const portion = z.number().min(0.1).max(5).parse(input.portion);
  const day = input.day ? daySchema.parse(input.day) : todayISO();

  // Typical (generic) dishes aren't stored as menu items; rebuild them from the id.
  if (parseTypicalId(input.menuItemId)) {
    const meal = await typicalViewById(input.menuItemId);
    const est = meal && resolveBasis(templateBasis(meal.name, meal.description ?? ""), selections).estimate;
    if (!meal || !est) throw new Error("Meal not found");
    const tv = est.values;
    await repo.addEntry({
      userId, day, menuItemId: null, restaurantId: meal.restaurant.id, name: `${meal.name} (typical)`, restaurantName: meal.restaurant.name,
      selections, portion, status: est.status, provider: est.provider, kcal: tv.kcal.likely, kcalMin: tv.kcal.min, kcalMax: tv.kcal.max,
      protein: tv.protein.likely, proteinMin: tv.protein.min, proteinMax: tv.protein.max, carbs: tv.carbs.likely, fat: tv.fat.likely, fiber: tv.fiber?.likely ?? null,
    });
    revalidatePath("/diary");
    return { ok: true, kcal: tv.kcal.likely * portion };
  }

  // Recompute on the server from the stored basis — never trust client numbers.
  const b = await getItemBasis(z.string().uuid().parse(input.menuItemId), { allowAi: false });
  if (!b) throw new Error("Meal not found");
  const { estimate } = resolveBasis(b.basis, selections);
  if (!estimate) throw new Error("This meal has no nutrition estimate to log");

  const item = await getMenuItem(input.menuItemId);
  const restaurant = item ? await getRestaurant(item.restaurantId) : null;
  const v = estimate.values;
  await repo.addEntry({
    userId,
    day,
    menuItemId: input.menuItemId,
    restaurantId: restaurant?.id ?? null,
    name: item?.name ?? "Meal",
    restaurantName: restaurant?.name ?? null,
    selections,
    portion,
    status: estimate.status,
    provider: estimate.provider,
    kcal: v.kcal.likely,
    kcalMin: v.kcal.min,
    kcalMax: v.kcal.max,
    protein: v.protein.likely,
    proteinMin: v.protein.min,
    proteinMax: v.protein.max,
    carbs: v.carbs.likely,
    fat: v.fat.likely,
    fiber: v.fiber?.likely ?? null,
  });
  revalidatePath("/diary");
  revalidatePath("/saved");
  return { ok: true, kcal: v.kcal.likely * portion };
}

export async function setEntryPortion(id: string, portion: number) {
  const { userId } = await getSession();
  await repo.updateEntry(userId, z.string().uuid().parse(id), { portion: z.number().min(0.1).max(5).parse(portion) });
  revalidatePath("/diary");
}

export async function deleteEntryAction(id: string) {
  const { userId } = await getSession();
  await repo.deleteEntry(userId, z.string().uuid().parse(id));
  revalidatePath("/diary");
}

/** Logs a previous entry again today, with the same nutrition snapshot. */
export async function repeatEntry(id: string, day?: string) {
  const { userId } = await getSession();
  const e = await repo.getEntry(userId, z.string().uuid().parse(id));
  if (!e) throw new Error("Entry not found");
  const { id: _id, loggedAt: _l, ...rest } = e;
  void _id;
  void _l;
  await repo.addEntry({ ...rest, day: day ? daySchema.parse(day) : todayISO() });
  revalidatePath("/diary");
  revalidatePath("/saved");
}

export async function toggleFavoriteAction(menuItemId: string, selections: unknown) {
  const { userId } = await getSession();
  const on = await repo.toggleFavorite(userId, z.string().uuid().parse(menuItemId), selectionsSchema.parse(selections));
  revalidatePath("/saved");
  return on;
}

export async function toggleSavedRestaurantAction(restaurantId: string) {
  const { userId } = await getSession();
  const on = await repo.toggleSavedRestaurant(userId, z.string().min(1).max(200).parse(restaurantId));
  revalidatePath("/saved");
  return on;
}

const goalsSchema = z.object({
  goalType: z.enum(["cut", "bulk", "maintain", "healthy", "custom"]),
  kcalTarget: z.coerce.number().min(1000).max(6000),
  proteinG: z.coerce.number().min(20).max(400),
  carbsG: z.coerce.number().min(0).max(900),
  fatG: z.coerce.number().min(10).max(300),
  weightKg: z.coerce.number().min(30).max(300).nullable().optional(),
});

export async function saveGoals(input: unknown) {
  const { userId } = await getSession();
  const g = goalsSchema.parse(input);
  await repo.saveProfile(userId, { ...g, weightKg: g.weightKg ?? null });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setShowDemo(show: boolean) {
  const { userId } = await getSession();
  await repo.saveProfile(userId, { showDemo: show });
  revalidatePath("/", "layout");
}

export async function deleteMyData() {
  const { userId } = await getSession();
  await repo.deleteUserData(userId);
  revalidatePath("/", "layout");
}

export async function signInWithEmail(email: string) {
  if (!supabaseConfigured()) return { ok: false, error: "Accounts are not enabled on this server." };
  const addr = z.string().email().parse(email);
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { error } = await (await supabaseServer()).auth.signInWithOtp({ email: addr, options: { emailRedirectTo: `${origin}/auth/callback` } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut() {
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  revalidatePath("/", "layout");
}

// ── Reads used by client pages ────────────────────────────────────────────

export async function getRestaurantPage(id: string): Promise<RestaurantPageData | null> {
  const r = await getRestaurant(z.string().min(1).max(200).parse(id));
  if (!r) return null;
  const { userId } = await getSession();
  const [real, favs, saved] = await Promise.all([mealViews({ restaurantIds: [r.id] }, userId), repo.listFavorites(userId), repo.listSavedRestaurants(userId)]);
  return {
    restaurant: { id: r.id, name: r.name, provider: r.provider, providerId: r.providerId, isDemo: r.isDemo, cuisines: r.cuisines, amenity: r.amenity, address: r.address, lat: r.lat, lng: r.lng, tags: r.tags },
    meals: real.length ? real : typicalViews(r),
    favoriteIds: favs.map((f) => f.menuItemId),
    saved: saved.some((s) => s.restaurantId === r.id),
    aiEnabled: Boolean(getLlmProvider()),
  };
}

export async function getDiary(requestedDay: string | null): Promise<DiaryData> {
  const today = todayISO();
  const day = requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) ? requestedDay : today;
  const { userId } = await getSession();
  const [profile, entries, recent, hist] = await Promise.all([repo.getProfile(userId), repo.listDay(userId, day), repo.recentEntries(userId, 8), repo.history(userId, shiftDay(day, -6), day)]);
  return {
    day,
    today,
    goals: { goalType: profile.goalType, kcalTarget: profile.kcalTarget, proteinG: profile.proteinG, carbsG: profile.carbsG, fatG: profile.fatG },
    entries: entries.map((e) => ({ id: e.id, name: e.name, restaurantName: e.restaurantName, portion: e.portion, status: e.status, provider: e.provider, kcal: e.kcal, kcalMin: e.kcalMin, kcalMax: e.kcalMax, protein: e.protein, carbs: e.carbs, fat: e.fat, loggedAt: e.loggedAt.toISOString() })),
    recent: recent.map((e) => ({ id: e.id, name: e.name, restaurantName: e.restaurantName, kcal: e.kcal * e.portion, protein: e.protein * e.portion })),
    week: Array.from({ length: 7 }, (_, i) => shiftDay(day, i - 6)).map((d) => ({ day: d, kcal: hist.find((h) => h.day === d)?.kcal ?? 0 })),
  };
}

export async function getSaved(): Promise<SavedData> {
  const { userId } = await getSession();
  const [favs, saved] = await Promise.all([repo.listFavorites(userId), repo.listSavedRestaurants(userId)]);
  const meals = await mealViews({ itemIds: favs.map((f) => f.menuItemId) }, userId);
  const restaurants = (await Promise.all(saved.map((s) => getRestaurant(s.restaurantId)))).filter((r) => r !== null);
  return {
    favorites: favs.flatMap((f) => {
      const meal = meals.find((m) => m.id === f.menuItemId);
      return meal ? [{ meal, selections: f.selections }] : [];
    }),
    restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, cuisines: r.cuisines, isDemo: r.isDemo, address: r.address })),
  };
}

export async function getProfilePage(): Promise<ProfileData> {
  const session = await getSession();
  const p = await repo.getProfile(session.userId);
  const llm = getLlmProvider();
  return {
    profile: { goalType: p.goalType, kcalTarget: p.kcalTarget, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG, weightKg: p.weightKg, showDemo: p.showDemo },
    account: { kind: session.kind, email: session.email, supabase: supabaseConfigured() },
    system: { ai: llm ? `${llm.id} · ${llm.model}` : null, places: placesProvider().attribution, foods: Object.values(FOOD_ATTRIBUTION), foodsRetrievedAt: FOODS_RETRIEVED_AT },
  };
}

/** Removes dishes the current user added (others' dishes are untouched). */
export async function deleteDishes(ids: string[]): Promise<number> {
  const { userId } = await getSession();
  const n = await deleteOwnDishes(userId, z.array(z.string().max(200)).max(200).parse(ids));
  revalidatePath("/saved");
  return n;
}
