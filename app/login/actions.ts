"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

const EmailSchema = z.string().trim().toLowerCase().email().max(254);

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Vetted magic link: only emails that already exist on a streamer row get a mail.
 * Unknown emails get the same neutral redirect so the allowlist is not enumerable.
 */
export async function requestMagicLink(formData: FormData) {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=email");
  const email = parsed.data;

  const admin = createAdminClient();
  const { data: streamer, error } = await admin
    .from("streamer")
    .select("id")
    .eq("auth_email", email)
    .maybeSingle();
  if (error) redirect("/login?error=server");

  if (streamer) {
    const sb = await createServerSupabase();
    const origin = await requestOrigin();
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
    });
    if (otpErr) redirect("/login?error=send");
  }

  redirect("/login?sent=1");
}
