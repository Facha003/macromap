import { NextResponse } from "next/server";
import { findMenuWithGemini } from "@/lib/menuFinder";
import { getRestaurant } from "@/server/repo/menu";
import { fail, limited } from "../../../_util";

/** AI web search (Gemini + Google Search grounding) for a restaurant's current menu. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "find-menu", 4);
  if (blocked) return blocked;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI menu search needs GEMINI_API_KEY on the server." }, { status: 400 });
  try {
    const r = await getRestaurant(decodeURIComponent((await ctx.params).id));
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json(
      await findMenuWithGemini({ apiKey: key, model: process.env.GEMINI_MODEL, restaurant: { name: r.name, address: r.address, lat: r.lat, lng: r.lng, cuisines: r.cuisines, website: r.tags.website ?? null } }),
    );
  } catch (e) {
    if (e instanceof Error && /Gemini|quota|key/.test(e.message)) return NextResponse.json({ error: e.message }, { status: 502 });
    return fail(e);
  }
}
