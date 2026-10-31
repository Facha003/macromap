import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth";
import { getItemBasis } from "@/server/nutrition/service";
import { createCommunityItem, getRestaurant, mealViews } from "@/server/repo/menu";
import { fail, limited } from "../../../_util";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  priceNok: z.number().min(0).max(5000).nullable().optional(),
});

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(500).nullable().optional(),
        priceNok: z.number().min(0).max(5000).nullable().optional(),
        sourceUrl: z.string().url().max(1000).nullable().optional(),
        category: z.string().trim().max(60).nullable().optional(),
      }),
    )
    .min(1)
    .max(80),
});

/** Lets a user add a dish they can see on a restaurant's menu; it is labelled "community". */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "community-item", 6);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  // Bulk import from a pasted menu: no AI here — each dish is estimated when opened.
  if (body && Array.isArray(body.items)) {
    const bulk = bulkSchema.safeParse(body);
    if (!bulk.success) return NextResponse.json({ error: "Couldn't read those dishes." }, { status: 400 });
    try {
      const restaurant = await getRestaurant(decodeURIComponent(id));
      if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
      const { userId } = await getSession();
      const existing = new Set((await mealViews({ restaurantIds: [restaurant.id] })).map((m) => m.name.toLowerCase()));
      let added = 0;
      for (const d of bulk.data.items) {
        if (existing.has(d.name.toLowerCase())) continue;
        existing.add(d.name.toLowerCase());
        await createCommunityItem(restaurant.id, userId, { name: d.name, description: d.description ?? undefined, priceNok: d.priceNok ?? null, sourceUrl: d.sourceUrl ?? null, category: d.category ?? null });
        added++;
      }
      return NextResponse.json({ added });
    } catch (e) {
      return fail(e);
    }
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please enter a dish name (2–120 characters)." }, { status: 400 });
  try {
    const restaurant = await getRestaurant(decodeURIComponent(id));
    if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    const { userId } = await getSession();
    const item = await createCommunityItem(restaurant.id, userId, parsed.data);
    const b = await getItemBasis(item.id, { allowAi: true });
    return NextResponse.json({ id: item.id, basis: b?.basis, aiNote: b?.aiNote });
  } catch (e) {
    return fail(e);
  }
}
