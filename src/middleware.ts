import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const UID_COOKIE = "mm_uid";

/**
 * Gives every visitor an anonymous id (a first-party cookie used only to key
 * their own diary and settings), and refreshes the Supabase session when
 * Supabase Auth is configured.
 */
export async function middleware(request: NextRequest) {
  let newUid: string | null = null;
  if (!request.cookies.get(UID_COOKIE)) {
    newUid = crypto.randomUUID();
    request.cookies.set(UID_COOKIE, newUid);
  }
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  }

  if (newUid) {
    response.cookies.set(UID_COOKIE, newUid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 400, path: "/" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
