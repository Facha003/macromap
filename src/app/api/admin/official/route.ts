import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { menuItems } from "@/server/db/schema";
import { importOfficial } from "@/server/nutrition/service";
import { getRestaurant } from "@/server/repo/menu";

const rowSchema = z.object({
  restaurantId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.string().max(60).optional(),
  priceNok: z.number().nonnegative().optional(),
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().nullable().optional(),
  sugar: z.number().nonnegative().nullable().optional(),
  sodiumMg: z.number().nonnegative().nullable().optional(),
  servingG: z.number().positive().nullable().optional(),
  /** Where the restaurant published these numbers — required. */
  sourceUrl: z.string().url(),
  checkedAt: z.string().date(),
});

function authorized(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return Boolean(token && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token)));
}

/**
 * Imports nutrition published by a restaurant or chain (status "verified").
 * Only for data the restaurant itself publishes, with the page it came from.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.array(rowSchema).max(500).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const db = await getDb();
  const results: { name: string; id?: string; error?: string }[] = [];
  for (const row of parsed.data) {
    const restaurant = await getRestaurant(row.restaurantId);
    if (!restaurant) {
      results.push({ name: row.name, error: "restaurant not found" });
      continue;
    }
    let [item] = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurant.id), eq(menuItems.name, row.name))).limit(1);
    if (!item) {
      [item] = await db
        .insert(menuItems)
        .values({ restaurantId: restaurant.id, name: row.name, description: row.description ?? null, category: row.category ?? null, priceNok: row.priceNok ?? null, sourceType: "official", sourceUrl: row.sourceUrl })
        .returning();
    }
    await importOfficial(item.id, { ...row, sourceUrl: row.sourceUrl, checkedAt: row.checkedAt });
    results.push({ name: row.name, id: item.id });
  }
  return NextResponse.json({ imported: results.filter((r) => r.id).length, results });
}
