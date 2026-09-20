import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Cookie-less client for PUBLIC reads (RLS: anon role). Safe to call inside
// `use cache` scopes because it touches no request data.
export function createAnonClient() {
  return createClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
