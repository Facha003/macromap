import { NextResponse } from "next/server";
import { getItemBasis } from "@/server/nutrition/service";
import { fail, limited } from "../../../_util";

/** Returns the best basis for one item; with ?ai=1 it may run (and cache) an AI estimate. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const allowAi = new URL(req.url).searchParams.get("ai") === "1";
  if (allowAi) {
    const blocked = limited(req, "estimate-ai", 12);
    if (blocked) return blocked;
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    const b = await getItemBasis(id, { allowAi });
    if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ basis: b.basis, aiNote: b.aiNote, estimatedAt: b.record.createdAt, model: b.record.model });
  } catch (e) {
    return fail(e);
  }
}
