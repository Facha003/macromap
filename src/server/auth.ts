import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

export interface Session {
  userId: string;
  email: string | null;
  kind: "supabase" | "anonymous";
}

/** Signed-in Supabase user, else the anonymous first-party cookie id. */
export async function getSession(): Promise<Session> {
  if (supabaseConfigured()) {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (data.user) return { userId: data.user.id, email: data.user.email ?? null, kind: "supabase" };
  }
  const uid = (await cookies()).get("mm_uid")?.value;
  if (!uid) throw new Error("Missing session cookie");
  return { userId: `anon:${uid}`, email: null, kind: "anonymous" };
}
