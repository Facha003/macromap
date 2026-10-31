"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { resolveBasis } from "@/lib/nutrition/basis";
import { presetTargets, type GoalType } from "@/lib/scoring";
import { todayISO } from "@/lib/format";
import { getSession, supabaseConfigured, supabaseServer } from "@/server/auth";
import { getItemBasis } from "@/server/nutrition/service";
import { getMenuItem, getRestaurant } from "@/server/repo/menu";
import * as repo from "@/server/repo/user";

const selectionsSchema = z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number()])).default({});
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function logMeal(input: { menuItemId: string; selections: unknown; portion: number; day?: string }) {
  const { userId } = await getSession();
  const selections = selectionsSchema.parse(input.selections);
  const portion = z.number().min(0.1).max(5).parse(input.portion);
  const day = input.day ? daySchema.parse(input.day) : todayISO();

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

export async function suggestTargets(goalType: GoalType, maintenanceKcal: number, weightKg: number | null) {
  return presetTargets(goalType, Math.min(6000, Math.max(1200, maintenanceKcal)), weightKg);
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
