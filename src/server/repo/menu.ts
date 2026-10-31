import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { templateBasis, type EstimateBasis } from "@/lib/nutrition/basis";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTypicalId, restaurantKind, typicalDish, typicalDishesFor, typicalId } from "@/lib/typicalDishes";
import { menuFileName, parseWebDishId, webDishId, type WebsiteMenu } from "@/lib/websiteMenuTypes";
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
  /** typical = generic dish for this kind of restaurant, NOT from its menu */
  sourceType: "official" | "community" | "demo" | "typical" | "website";
  sourceUrl: string | null;
  lastChecked: string;
  statedDiet: { vegetarian?: boolean; vegan?: boolean; halal?: boolean };
  basis: EstimateBasis;
  estimatedAt: string;
  model: string | null;
  restaurant: { id: string; name: string; isDemo: boolean; lat: number; lng: number; cuisines: string[]; halal: boolean; halalTag?: string | null };
  /** True when the current user added this dish (and so may delete it). */
  addedByMe?: boolean;
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

type RestaurantLike = Pick<Restaurant, "id" | "name" | "isDemo" | "lat" | "lng" | "cuisines" | "amenity" | "tags">;

function typicalView(r: RestaurantLike, slug: string, name: string, description: string, label: string): MealView {
  const now = new Date().toISOString();
  return {
    id: typicalId(r.id, slug), name, description, category: `Typical for ${label}`, priceNok: null, sourceType: "typical", sourceUrl: null,
    lastChecked: now, statedDiet: {}, basis: templateBasis(name, description), estimatedAt: now, model: null,
    restaurant: { id: r.id, name: r.name, isDemo: r.isDemo, lat: r.lat, lng: r.lng, cuisines: r.cuisines, halal: r.tags.halal === "yes" || r.tags.halal === "only", halalTag: r.tags.halal ?? null },
  };
}

/** Generic dishes for this kind of restaurant — shown (and labelled) only when it has no menu. */
export function typicalViews(r: RestaurantLike): MealView[] {
  const t = typicalDishesFor(r);
  return t ? t.dishes.map((d) => typicalView(r, d.slug, d.name, d.description, t.label)) : [];
}

function readWebsiteMenu(restaurantId: string): WebsiteMenu | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "menus", `${menuFileName(restaurantId)}.json`), "utf8")) as WebsiteMenu;
  } catch {
    return null;
  }
}

/** Dishes read from the restaurant's own website by scripts/crawl-menus.ts, if any. */
export function websiteViews(r: RestaurantLike): MealView[] {
  const menu = readWebsiteMenu(r.id);
  if (!menu) return [];
  return menu.dishes.map((d, n) => ({
    id: webDishId(r.id, n), name: d.name, description: d.description, category: "From their website", priceNok: d.priceNok, sourceType: "website" as const,
    sourceUrl: menu.sourceUrl, lastChecked: menu.checkedAt, statedDiet: {}, basis: templateBasis(d.name, d.description ?? "", "template", restaurantKind(r)), estimatedAt: menu.checkedAt, model: null,
    restaurant: { id: r.id, name: r.name, isDemo: r.isDemo, lat: r.lat, lng: r.lng, cuisines: r.cuisines, halal: r.tags.halal === "yes" || r.tags.halal === "only", halalTag: r.tags.halal ?? null },
  }));
}

/** Website or typical dish by its derived id (these aren't stored as menu_items). */
export async function derivedViewById(id: string): Promise<MealView | null> {
  const w = parseWebDishId(id);
  if (w) {
    const r = await getRestaurant(w.restaurantId);
    return r ? (websiteViews(r).find((m) => m.id === id) ?? null) : null;
  }
  return typicalViewById(id);
}

const isDerivedId = (id: string) => Boolean(parseTypicalId(id) || parseWebDishId(id));

export async function typicalViewById(id: string): Promise<MealView | null> {
  const t = parseTypicalId(id);
  const r = t && (await getRestaurant(t.restaurantId));
  const found = r && typicalDish(r, t.slug);
  return r && found ? typicalView(r, t.slug, found.dish.name, found.dish.description, found.label) : null;
}

export async function mealViews(where: { restaurantIds?: string[]; itemIds?: string[] }, viewerId?: string): Promise<MealView[]> {
  if (where.itemIds?.some(isDerivedId)) {
    const typical = (await Promise.all(where.itemIds.filter(isDerivedId).map(derivedViewById))).filter((m): m is MealView => m !== null);
    const real = await mealViews({ ...where, itemIds: where.itemIds.filter((id) => !isDerivedId(id)) }, viewerId);
    return [...real, ...typical];
  }
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
      addedByMe: Boolean(viewerId && item.sourceType === "community" && item.createdBy === viewerId),
      restaurant: { id: r.id, name: r.name, isDemo: r.isDemo, lat: r.lat, lng: r.lng, cuisines: r.cuisines, halal: r.tags.halal === "yes" || r.tags.halal === "only", halalTag: r.tags.halal ?? null },
    };
  });
}

export async function createCommunityItem(restaurantId: string, userId: string, input: { name: string; description?: string; priceNok?: number | null; sourceUrl?: string | null; category?: string | null }) {
  const db = await getDb();
  const [row] = await db
    .insert(menuItems)
    .values({
      restaurantId,
      name: input.name.trim().slice(0, 120),
      description: input.description?.trim().slice(0, 500) || null,
      priceNok: input.priceNok ?? null,
      category: input.category || "Added by users",
      sourceType: "community",
      sourceUrl: input.sourceUrl ?? null,
      createdBy: userId,
    })
    .returning();
  return row;
}

/** Deletes dishes the user added themselves; returns how many were removed. */
export async function deleteOwnDishes(userId: string, ids: string[]): Promise<number> {
  const uuids = ids.filter((id) => /^[0-9a-f-]{36}$/.test(id));
  if (!uuids.length) return 0;
  const db = await getDb();
  const removed = await db
    .delete(menuItems)
    .where(and(inArray(menuItems.id, uuids), eq(menuItems.createdBy, userId), eq(menuItems.sourceType, "community")))
    .returning({ id: menuItems.id });
  return removed.length;
}
