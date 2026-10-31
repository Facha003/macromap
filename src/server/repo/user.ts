import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { diaryEntries, favorites, profiles, savedRestaurants } from "../db/schema";

export type Profile = typeof profiles.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;

export const DEFAULT_PROFILE: Omit<Profile, "userId" | "updatedAt"> = {
  goalType: "maintain",
  kcalTarget: 2200,
  proteinG: 130,
  carbsG: 250,
  fatG: 73,
  weightKg: null,
  showDemo: true,
};

export async function getProfile(userId: string): Promise<Profile> {
  const db = await getDb();
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return p ?? { userId, updatedAt: new Date(0), ...DEFAULT_PROFILE };
}

export async function saveProfile(userId: string, patch: Partial<Omit<Profile, "userId" | "updatedAt">>) {
  const db = await getDb();
  const current = await getProfile(userId);
  const next = { ...current, ...patch, userId, updatedAt: new Date() };
  await db.insert(profiles).values(next).onConflictDoUpdate({ target: profiles.userId, set: { ...patch, updatedAt: new Date() } });
  return next;
}

export async function listDay(userId: string, day: string): Promise<DiaryEntry[]> {
  const db = await getDb();
  return db.select().from(diaryEntries).where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.day, day))).orderBy(diaryEntries.loggedAt);
}

export function totalsOf(entries: DiaryEntry[]) {
  return entries.reduce(
    (t, e) => ({
      kcal: t.kcal + e.kcal * e.portion,
      kcalMin: t.kcalMin + e.kcalMin * e.portion,
      kcalMax: t.kcalMax + e.kcalMax * e.portion,
      protein: t.protein + e.protein * e.portion,
      carbs: t.carbs + e.carbs * e.portion,
      fat: t.fat + e.fat * e.portion,
    }),
    { kcal: 0, kcalMin: 0, kcalMax: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export async function history(userId: string, fromDay: string, toDay: string) {
  const db = await getDb();
  return db
    .select({
      day: diaryEntries.day,
      kcal: sql<number>`sum(${diaryEntries.kcal} * ${diaryEntries.portion})::float`,
      protein: sql<number>`sum(${diaryEntries.protein} * ${diaryEntries.portion})::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), gte(diaryEntries.day, fromDay), lte(diaryEntries.day, toDay)))
    .groupBy(diaryEntries.day)
    .orderBy(diaryEntries.day);
}

export async function recentEntries(userId: string, limit = 12): Promise<DiaryEntry[]> {
  const db = await getDb();
  const rows = await db.select().from(diaryEntries).where(eq(diaryEntries.userId, userId)).orderBy(desc(diaryEntries.loggedAt)).limit(60);
  // One row per distinct meal + customization, most recent first.
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.menuItemId ?? r.name}|${JSON.stringify(r.selections)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, limit);
}

export async function addEntry(entry: typeof diaryEntries.$inferInsert) {
  const db = await getDb();
  const [row] = await db.insert(diaryEntries).values(entry).returning();
  return row;
}

export async function updateEntry(userId: string, id: string, patch: { portion?: number; day?: string }) {
  const db = await getDb();
  await db.update(diaryEntries).set(patch).where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId)));
}

export async function deleteEntry(userId: string, id: string) {
  const db = await getDb();
  await db.delete(diaryEntries).where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId)));
}

export async function getEntry(userId: string, id: string) {
  const db = await getDb();
  const [row] = await db.select().from(diaryEntries).where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId))).limit(1);
  return row ?? null;
}

export async function listFavorites(userId: string) {
  const db = await getDb();
  return db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
}

export async function toggleFavorite(userId: string, menuItemId: string, selections: Record<string, unknown>) {
  const db = await getDb();
  const where = and(eq(favorites.userId, userId), eq(favorites.menuItemId, menuItemId));
  const [existing] = await db.select().from(favorites).where(where).limit(1);
  if (existing) {
    await db.delete(favorites).where(where);
    return false;
  }
  await db.insert(favorites).values({ userId, menuItemId, selections: selections as never });
  return true;
}

export async function listSavedRestaurants(userId: string) {
  const db = await getDb();
  return db.select().from(savedRestaurants).where(eq(savedRestaurants.userId, userId)).orderBy(desc(savedRestaurants.createdAt));
}

export async function toggleSavedRestaurant(userId: string, restaurantId: string) {
  const db = await getDb();
  const where = and(eq(savedRestaurants.userId, userId), eq(savedRestaurants.restaurantId, restaurantId));
  const [existing] = await db.select().from(savedRestaurants).where(where).limit(1);
  if (existing) {
    await db.delete(savedRestaurants).where(where);
    return false;
  }
  await db.insert(savedRestaurants).values({ userId, restaurantId });
  return true;
}

/** GDPR: everything stored about this user. */
export async function exportUserData(userId: string) {
  const db = await getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    userId,
    profile: profile ?? null,
    diary: await db.select().from(diaryEntries).where(eq(diaryEntries.userId, userId)),
    favorites: await listFavorites(userId),
    savedRestaurants: await listSavedRestaurants(userId),
  };
}

export async function deleteUserData(userId: string) {
  const db = await getDb();
  await db.delete(diaryEntries).where(eq(diaryEntries.userId, userId));
  await db.delete(favorites).where(eq(favorites.userId, userId));
  await db.delete(savedRestaurants).where(eq(savedRestaurants.userId, userId));
  await db.delete(profiles).where(eq(profiles.userId, userId));
}
