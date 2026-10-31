import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth";
import { getItemBasis } from "@/server/nutrition/service";
import { createCommunityItem, getRestaurant } from "@/server/repo/menu";
import { fail, limited } from "../../../_util";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  priceNok: z.number().min(0).max(5000).nullable().optional(),
});

/** Lets a user add a dish they can see on a restaurant's menu; it is labelled "community". */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "community-item", 6);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
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
