import { NextResponse } from "next/server";
import { mealViews } from "@/server/repo/menu";
import { fail, limited } from "../_util";

export async function GET(req: Request) {
  const blocked = limited(req, "items", 60);
  if (blocked) return blocked;
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x) || x.startsWith("typical:") || x.startsWith("web:")).slice(0, 20);
  try {
    return NextResponse.json({ meals: await mealViews({ itemIds: ids }) });
  } catch (e) {
    return fail(e);
  }
}
