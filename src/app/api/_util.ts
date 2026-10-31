import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/server/rateLimit";

export function limited(req: Request, bucket: string, perMinute: number) {
  if (rateLimit(`${bucket}:${clientKey(req)}`, perMinute)) return null;
  return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
}

export function num(v: string | null, fallback: number, min: number, max: number) {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? Math.min(max, Math.max(min, n)) : fallback;
}

export function fail(e: unknown) {
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
