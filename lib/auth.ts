import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { StreamerRow } from "@/lib/types";

/**
 * The signed-in owner's streamer row, or null. Reads cookies → only call from
 * Server Actions or components behind a Suspense boundary; never inside `use cache`.
 */
export async function getOwnerStreamer(): Promise<StreamerRow | null> {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return null;

  const { data, error } = await sb
    .from("streamer")
    .select("*")
    .eq("auth_email", user.email.toLowerCase())
    .maybeSingle<StreamerRow>();
  if (error) throw error;
  return data ?? null;
}
