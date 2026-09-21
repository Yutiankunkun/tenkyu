"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentAdminEmail } from "@/lib/admin";
import { fetchLiveProfile } from "@/lib/bilibili";
import { STREAMERS_TAG, scheduleTag } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { HANDLE_RE } from "@/lib/types";

async function requireAdmin() {
  const email = await currentAdminEmail();
  if (!email) redirect("/login");
  return email;
}

function back(params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`/admin${q ? `?${q}` : ""}`);
}

/** Step 1: look the UID up on Bilibili and bounce back with the fields prefilled in the URL. */
export async function previewUid(formData: FormData) {
  await requireAdmin();
  const uid = z.coerce.number().int().positive().safeParse(formData.get("uid"));
  if (!uid.success) back({ error: "UID 必须是正整数" });
  // redirect() throws, so it must stay outside the try/catch.
  let p: Awaited<ReturnType<typeof fetchLiveProfile>> | null = null;
  let err = "";
  try {
    p = await fetchLiveProfile(uid.data);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  if (!p) back({ uid: String(uid.data), error: `B 站接口失败：${err}。可手动填写。` });
  back({
    uid: String(p.uid),
    display_name: p.uname,
    avatar_url: p.face,
    bili_room_id: p.room_id ? String(p.room_id) : "",
    note: p.area,
  });
}

const CreateSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE, "handle 只能是小写字母、数字、连字符，2–31 位"),
  auth_email: z.string().trim().toLowerCase().email("邮箱格式不对").max(254),
  display_name: z.string().trim().min(1, "名字不能为空").max(40),
  avatar_url: z.union([z.literal(""), z.url().max(500)]),
  bili_uid: z.union([z.literal(""), z.coerce.number().int().positive()]),
  bili_room_id: z.union([z.literal(""), z.coerce.number().int().positive()]),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式不对"),
  intro: z.string().trim().max(200),
});

/** Step 2: create the streamer row (service role), status invited. */
export async function createStreamer(formData: FormData) {
  await requireAdmin();
  const r = CreateSchema.safeParse({
    handle: formData.get("handle") ?? "",
    auth_email: formData.get("auth_email") ?? "",
    display_name: formData.get("display_name") ?? "",
    avatar_url: (formData.get("avatar_url") ?? "").toString().trim(),
    bili_uid: (formData.get("bili_uid") ?? "").toString().trim(),
    bili_room_id: (formData.get("bili_room_id") ?? "").toString().trim(),
    theme_color: formData.get("theme_color") ?? "#5B8DEF",
    intro: formData.get("intro") ?? "",
  });
  if (!r.success) back({ error: r.error.issues[0]?.message ?? "输入有误" });
  const p = r.data;

  const admin = createAdminClient();
  const { error } = await admin.from("streamer").insert({
    handle: p.handle,
    auth_email: p.auth_email,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    bili_uid: p.bili_uid === "" ? null : p.bili_uid,
    bili_room_id: p.bili_room_id === "" ? null : p.bili_room_id,
    theme_color: p.theme_color,
    intro: p.intro,
    status: "invited",
  });
  if (error) {
    const msg = error.code === "23505" ? "handle 或邮箱已存在" : error.message;
    back({ error: `创建失败：${msg}` });
  }
  updateTag(STREAMERS_TAG);
  back({ created: p.handle });
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["invited", "active", "hidden"]),
});

export async function setStreamerStatus(formData: FormData) {
  await requireAdmin();
  const r = StatusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!r.success) back({ error: "参数有误" });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("streamer")
    .update({ status: r.data.status })
    .eq("id", r.data.id)
    .select("handle")
    .maybeSingle<{ handle: string }>();
  if (error) back({ error: `更新失败：${error.message}` });
  updateTag(STREAMERS_TAG);
  if (data?.handle) updateTag(scheduleTag(data.handle));
  back({});
}
