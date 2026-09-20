import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Session-aware client for Server Components and Server Actions (owner reads/writes
// under RLS). Reads request cookies, so callers must sit behind a Suspense boundary
// (Cache Components) and must never be inside a `use cache` scope.
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy
          // refreshes the session cookie, so ignoring the write is safe.
        }
      },
    },
  });
}
