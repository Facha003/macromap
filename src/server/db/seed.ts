import { sql } from "drizzle-orm";
import demo from "../../../data/demo/oslo.json";
import { FOODS } from "@/lib/nutrition/estimate";
import type { Db } from "./index";
import { foods, menuItems, restaurants, type RestaurantTags } from "./schema";

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

export async function seedFoods(db: Db) {
  const rows = Object.values(FOODS).map((f) => ({
    key: f.key,
    label: f.label,
    foodGroup: f.group,
    sourceDb: f.source,
    sourceId: f.sourceId,
    sourceName: f.sourceName,
    sourceUrl: f.sourceUrl,
    per100g: f.per100g,
    retrievedAt: new Date(f.retrievedAt),
  }));
  await db
    .insert(foods)
    .values(rows)
    .onConflictDoUpdate({
      target: foods.key,
      set: {
        label: sql`excluded.label`,
        foodGroup: sql`excluded.food_group`,
        sourceId: sql`excluded.source_id`,
        sourceName: sql`excluded.source_name`,
        sourceUrl: sql`excluded.source_url`,
        per100g: sql`excluded.per100g`,
        retrievedAt: sql`excluded.retrieved_at`,
      },
    });
}

export async function seedDemo(db: Db) {
  for (const r of (demo as { restaurants: DemoRestaurant[] }).restaurants) {
    const id = `demo:${r.slug}`;
    await db
      .insert(restaurants)
      .values({
        id,
        provider: "demo",
        providerId: r.slug,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        address: r.address,
        city: "Oslo",
        countryCode: "NO",
        cuisines: r.cuisines,
        amenity: r.amenity,
        tags: r.tags,
        isDemo: true,
      })
      .onConflictDoNothing();
    const existing = await db.select({ id: menuItems.id }).from(menuItems).where(sql`${menuItems.restaurantId} = ${id}`).limit(1);
    if (existing.length) continue;
    await db.insert(menuItems).values(
      r.items.map((i) => ({
        restaurantId: id,
        name: i.name,
        description: i.description,
        category: i.category,
        priceNok: i.price,
        sourceType: "demo" as const,
        statedDiet: i.diet ?? {},
      })),
    );
  }
}

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(foods);
  if (n < Object.keys(FOODS).length) await seedFoods(db);
  const [{ d }] = await db.select({ d: sql<number>`count(*)::int` }).from(restaurants).where(sql`${restaurants.isDemo}`);
  if (d === 0) await seedDemo(db);
}
