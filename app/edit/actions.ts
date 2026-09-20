"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getOwnerStreamer } from "@/lib/auth";
import { STREAMERS_TAG, scheduleTag } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { hhmmToMinutes, isMonday } from "@/lib/time";
import type { Slot, SlotTemplateRow, StreamerRow, WeekOverrideRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function requireOwner(): Promise<StreamerRow> {
  const s = await getOwnerStreamer();
  if (!s) redirect("/login");
  return s;
}

function fail(msg: string): never {
  redirect(`/edit?error=${encodeURIComponent(msg)}`);
}

async function afterScheduleChange(streamer: StreamerRow) {
  updateTag(scheduleTag(streamer.handle));
  await maybeActivate(streamer);
  revalidatePath("/edit");
}

/** invited → active once the profile has a name and ≥1 template slot. Service role (guarded column). */
async function maybeActivate(streamer: StreamerRow) {
  if (streamer.status !== "invited") return;
  const sb = await createServerSupabase();
  const [{ data: fresh }, { count }] = await Promise.all([
    sb.from("streamer").select("display_name").eq("id", streamer.id).maybeSingle<{ display_name: string }>(),
    sb.from("slot_template").select("id", { count: "exact", head: true }).eq("streamer_id", streamer.id),
  ]);
  if (!fresh?.display_name || !count) return;
  const admin = createAdminClient();
  const { error } = await admin.from("streamer").update({ status: "active" }).eq("id", streamer.id);
  if (error) return;
  updateTag(STREAMERS_TAG);
  updateTag(scheduleTag(streamer.handle));
}

const SlotInput = z
  .object({
    start: z.string(),
    end: z.string(),
    next_day: z.string().optional(),
    type: z.string().trim().max(20),
    type_custom: z.string().trim().max(20).optional().default(""),
    note: z.string().trim().max(200).optional().default(""),
  })
  .transform((v, ctx) => {
    const start = hhmmToMinutes(v.start);
    const end0 = hhmmToMinutes(v.end);
    if (start === null || end0 === null) {
      ctx.addIssue({ code: "custom", message: "时间格式不对" });
      return z.NEVER;
    }
    const end = end0 + (v.next_day ? 1440 : 0);
    if (end <= start) {
      ctx.addIssue({ code: "custom", message: "结束时间要晚于开始时间（跨夜请勾选次日）" });
      return z.NEVER;
    }
    if (end > 2879) {
      ctx.addIssue({ code: "custom", message: "结束时间超出范围" });
      return z.NEVER;
    }
    const type = (v.type_custom || v.type || "杂谈").slice(0, 20);
    const slot: Slot = { start_min: start, end_min: end, type, note: v.note };
    return slot;
  });

function parseSlot(fd: FormData): Slot {
  const r = SlotInput.safeParse({
    start: fd.get("start"),
    end: fd.get("end"),
    next_day: fd.get("next_day") ?? undefined,
    type: fd.get("type") ?? "",
    type_custom: fd.get("type_custom") ?? "",
    note: fd.get("note") ?? "",
  });
  if (!r.success) fail(r.error.issues[0]?.message ?? "输入有误");
  return r.data;
}

const WeekdaySchema = z.coerce.number().int().min(1).max(7);
const WeekStartSchema = z.string().refine(isMonday, "周起始日必须是周一");

function parseDayKey(fd: FormData): { week_start: string; weekday: number } {
  const ws = WeekStartSchema.safeParse(fd.get("week_start"));
  const wd = WeekdaySchema.safeParse(fd.get("weekday"));
  if (!ws.success || !wd.success) fail("日期参数有误");
  return { week_start: ws.data, weekday: wd.data };
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------
const ProfileSchema = z.object({
  display_name: z.string().trim().min(1, "名字不能为空").max(40),
  avatar_url: z.union([z.literal(""), z.url().max(500)]),
  bili_room_id: z.union([z.literal(""), z.coerce.number().int().positive()]),
  bili_uid: z.union([z.literal(""), z.coerce.number().int().positive()]),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式不对"),
  intro: z.string().trim().max(200),
});

export async function saveProfile(formData: FormData) {
  const streamer = await requireOwner();
  const r = ProfileSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    avatar_url: (formData.get("avatar_url") ?? "").toString().trim(),
    bili_room_id: (formData.get("bili_room_id") ?? "").toString().trim(),
    bili_uid: (formData.get("bili_uid") ?? "").toString().trim(),
    theme_color: formData.get("theme_color") ?? "",
    intro: formData.get("intro") ?? "",
  });
  if (!r.success) fail(r.error.issues[0]?.message ?? "输入有误");
  const p = r.data;

  const sb = await createServerSupabase();
  const { error } = await sb
    .from("streamer")
    .update({
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      bili_room_id: p.bili_room_id === "" ? null : p.bili_room_id,
      bili_uid: p.bili_uid === "" ? null : p.bili_uid,
      theme_color: p.theme_color,
      intro: p.intro,
    })
    .eq("id", streamer.id);
  if (error) fail("保存失败：" + error.message);
  await afterScheduleChange(streamer);
  redirect("/edit?saved=profile");
}

// ---------------------------------------------------------------------------
// weekly template
// ---------------------------------------------------------------------------
export async function addTemplateSlot(formData: FormData) {
  const streamer = await requireOwner();
  const wd = WeekdaySchema.safeParse(formData.get("weekday"));
  if (!wd.success) fail("星期参数有误");
  const slot = parseSlot(formData);

  const sb = await createServerSupabase();
  const { error } = await sb.from("slot_template").insert({ streamer_id: streamer.id, weekday: wd.data, ...slot });
  if (error) fail("保存失败：" + error.message);
  await afterScheduleChange(streamer);
}

export async function deleteTemplateSlot(formData: FormData) {
  const streamer = await requireOwner();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail("参数有误");
  const sb = await createServerSupabase();
  const { error } = await sb.from("slot_template").delete().eq("id", id.data).eq("streamer_id", streamer.id);
  if (error) fail("删除失败：" + error.message);
  await afterScheduleChange(streamer);
}

// ---------------------------------------------------------------------------
// week overrides
// ---------------------------------------------------------------------------
async function effectiveSlots(streamerId: string, week_start: string, weekday: number): Promise<Slot[]> {
  const sb = await createServerSupabase();
  const { data: ov } = await sb
    .from("week_override")
    .select("mode, slots")
    .eq("streamer_id", streamerId)
    .eq("week_start", week_start)
    .eq("weekday", weekday)
    .maybeSingle<Pick<WeekOverrideRow, "mode" | "slots">>();
  if (ov) return ov.mode === "off" ? [] : (ov.slots ?? []);
  const { data: tpl } = await sb
    .from("slot_template")
    .select("start_min, end_min, type, note")
    .eq("streamer_id", streamerId)
    .eq("weekday", weekday)
    .returns<Pick<SlotTemplateRow, "start_min" | "end_min" | "type" | "note">[]>();
  return (tpl ?? []).map((t) => ({ start_min: t.start_min, end_min: t.end_min, type: t.type, note: t.note }));
}

async function upsertOverride(streamerId: string, week_start: string, weekday: number, mode: "replace" | "off", slots: Slot[]) {
  const sb = await createServerSupabase();
  const { error } = await sb
    .from("week_override")
    .upsert({ streamer_id: streamerId, week_start, weekday, mode, slots }, { onConflict: "streamer_id,week_start,weekday" });
  if (error) fail("保存失败：" + error.message);
}

export async function setDayOff(formData: FormData) {
  const streamer = await requireOwner();
  const { week_start, weekday } = parseDayKey(formData);
  await upsertOverride(streamer.id, week_start, weekday, "off", []);
  await afterScheduleChange(streamer);
}

export async function resetDay(formData: FormData) {
  const streamer = await requireOwner();
  const { week_start, weekday } = parseDayKey(formData);
  const sb = await createServerSupabase();
  const { error } = await sb
    .from("week_override")
    .delete()
    .eq("streamer_id", streamer.id)
    .eq("week_start", week_start)
    .eq("weekday", weekday);
  if (error) fail("恢复失败：" + error.message);
  await afterScheduleChange(streamer);
}

export async function addOverrideSlot(formData: FormData) {
  const streamer = await requireOwner();
  const { week_start, weekday } = parseDayKey(formData);
  const slot = parseSlot(formData);
  const current = await effectiveSlots(streamer.id, week_start, weekday);
  await upsertOverride(streamer.id, week_start, weekday, "replace", [...current, slot]);
  await afterScheduleChange(streamer);
}

export async function deleteOverrideSlot(formData: FormData) {
  const streamer = await requireOwner();
  const { week_start, weekday } = parseDayKey(formData);
  const idx = z.coerce.number().int().min(0).safeParse(formData.get("index"));
  if (!idx.success) fail("参数有误");
  const current = [...(await effectiveSlots(streamer.id, week_start, weekday))].sort((a, b) => a.start_min - b.start_min);
  if (idx.data >= current.length) fail("该时段已不存在");
  current.splice(idx.data, 1);
  await upsertOverride(streamer.id, week_start, weekday, current.length ? "replace" : "off", current);
  await afterScheduleChange(streamer);
}

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------
export async function signOut() {
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect("/");
}
