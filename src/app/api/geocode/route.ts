import { NextResponse } from "next/server";
import { geocode } from "@/server/places/geocode";
import { fail, limited } from "../_util";

export async function GET(req: Request) {
  const blocked = limited(req, "geocode", 20);
  if (blocked) return blocked;
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 200);
  try {
    return NextResponse.json({ results: await geocode(q), attribution: "Search by Nominatim © OpenStreetMap contributors" });
  } catch (e) {
    return fail(e);
  }
}
