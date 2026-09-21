import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

/** Admin = signed-in email listed in ADMIN_EMAILS (comma-separated). Empty list → nobody. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function currentAdminEmail(): Promise<string | null> {
  const list = adminEmails();
  if (list.length === 0) return null;
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const email = user?.email?.toLowerCase();
  return email && list.includes(email) ? email : null;
}
