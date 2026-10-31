import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseServer } from "@/server/auth";

/** Magic-link landing: exchanges the one-time code for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code && supabaseConfigured()) {
    await (await supabaseServer()).auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/profile", url.origin));
}
