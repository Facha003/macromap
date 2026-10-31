import { NextResponse } from "next/server";
import { OSLO } from "@/lib/geo";
import { getSession } from "@/server/auth";
import { discover, MAX_RADIUS_M } from "@/server/places";
import { getProfile } from "@/server/repo/user";
import { fail, limited, num } from "../_util";

export async function GET(req: Request) {
  const blocked = limited(req, "places", 30);
  if (blocked) return blocked;
  const p = new URL(req.url).searchParams;
  try {
    const { userId } = await getSession();
    const profile = await getProfile(userId);
    const data = await discover(num(p.get("lat"), OSLO.lat, -90, 90), num(p.get("lng"), OSLO.lng, -180, 180), num(p.get("radius"), 2000, 200, MAX_RADIUS_M), { showDemo: profile.showDemo });
    return NextResponse.json(data);
  } catch (e) {
    return fail(e);
  }
}
