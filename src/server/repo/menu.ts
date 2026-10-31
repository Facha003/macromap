import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { EstimateBasis } from "@/lib/nutrition/basis";
import { getDb } from "../db";
import { menuItems, restaurants } from "../db/schema";
import { ensureEstimates, latestRecords } from "../nutrition/service";

export type Restaurant = typeof restaurants.$inferSelect;

/** Serializable menu item with its nutrition basis — the client resolves it. */
export interface MealView {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceNok: number | null;
  sourceType: "official" | "community" | "demo";
  sourceUrl: string | null;
  lastChecked: string;
  statedDiet: { vegetarian?: boolean; vegan?: boolean; halal?: boolean };
  basis: EstimateBasis;
  estimatedAt: string;
  model: string | null;
  restaurant: { id: string; name: string; isDemo: boolean; lat: number; lng: number; cuisines: string[]; halal: boolean };
}

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const db = await getDb();
  const [r] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
  return r ?? null;
}

export async function getMenuItem(id: string) {
  const db = await getDb();
  const [r] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return r ?? null;
}

export async function mealViews(where: { restaurantIds?: string[]; itemIds?: string[] }): Promise<MealView[]> {
  const db = await getDb();
  const conds = [
    where.restaurantIds ? inArray(menuItems.restaurantId, where.restaurantIds.length ? where.restaurantIds : ["-"]) : undefined,
    where.itemIds ? inArray(menuItems.id, where.itemIds.length ? where.itemIds : ["00000000-0000-0000-0000-000000000000"]) : undefined,
  ];
  const rows = await db
    .select({ item: menuItems, r: restaurants })
    .from(menuItems)
    .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
    .where(and(...conds))
    .orderBy(menuItems.category, menuItems.name);
  await ensureEstimates(rows.map((x) => x.item.id));
  const recs = await latestRecords(rows.map((x) => x.item.id));
  return rows.map(({ item, r }) => {
    const rec = recs.get(item.id)!;
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      priceNok: item.priceNok,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      lastChecked: item.lastChecked.toISOString(),
      statedDiet: item.statedDiet,
      basis: rec.basis,
      estimatedAt: rec.createdAt.toISOString(),
      model: rec.model,
      restaurant: { id: r.id, name: r.name, isDemo: r.isDemo, lat: r.lat, lng: r.lng, cuisines: r.cuisines, halal: r.tags.halal === "yes" || r.tags.halal === "only" },
    };
  });
}

export async function createCommunityItem(restaurantId: string, userId: string, input: { name: string; description?: string; priceNok?: number | null }) {
  const db = await getDb();
  const [row] = await db
    .insert(menuItems)
    .values({
      restaurantId,
      name: input.name.trim().slice(0, 120),
      description: input.description?.trim().slice(0, 500) || null,
      priceNok: input.priceNok ?? null,
      category: "Added by users",
      sourceType: "community",
      createdBy: userId,
    })
    .returning();
  return row;
}
