import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { adminEmails, currentAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StreamerRow } from "@/lib/types";
import { createStreamer, previewUid, setStreamerStatus } from "./actions";

export const metadata = { title: "管理", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | undefined>>;

export default function AdminPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">加载中…</p>}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const input = "rounded-md border border-line bg-bg px-2 py-1.5 text-sm";
const btn = "rounded-md border border-line px-2.5 py-1 text-sm hover:bg-fg/5";
const btnPrimary = "rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:opacity-90";

async function Admin({ searchParams }: { searchParams: SP }) {
  await connection(); // read ADMIN_EMAILS at request time, never bake a 404 into the build
  if (adminEmails().length === 0) notFound();
  const [admin, sp] = await Promise.all([currentAdminEmail(), searchParams]);
  if (!admin) notFound();

  const db = createAdminClient();
  const { data: streamers } = await db
    .from("streamer")
    .select("id, handle, auth_email, display_name, bili_uid, status, created_at")
    .order("created_at")
    .returns<Pick<StreamerRow, "id" | "handle" | "auth_email" | "display_name" | "bili_uid" | "status" | "created_at">[]>();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">管理</h1>
        <p className="text-sm text-muted">{admin}</p>
      </header>

      {sp.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{sp.error}</p> : null}
      {sp.created ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          已创建 {sp.created}（状态 invited）。把 tenkyu.app/login 发给她即可。
        </p>
      ) : null}

      {/* 1. UID 预览 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">按 UID 建档</h2>
        <form action={previewUid} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            B 站 UID
            <input name="uid" inputMode="numeric" defaultValue={sp.uid ?? ""} required className={`${input} mt-1 block w-44`} />
          </label>
          <button className={btn}>从 B 站拉取资料</button>
          {sp.note ? <span className="pb-2 text-xs text-muted">{sp.note}</span> : null}
        </form>

        {/* 2. 创建 */}
        <form action={createStreamer} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
          <label className="text-sm">
            handle（公开地址 tenkyu.app/…）
            <input name="handle" required pattern="[a-z0-9][a-z0-9-]{1,30}" className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            登录邮箱
            <input name="auth_email" type="email" required className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            名字
            <input name="display_name" required maxLength={40} defaultValue={sp.display_name ?? ""} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            主题色
            <input name="theme_color" type="color" defaultValue="#5B8DEF" className="mt-1 block h-9 w-16" />
          </label>
          <label className="text-sm sm:col-span-2">
            头像链接
            <input name="avatar_url" type="url" defaultValue={sp.avatar_url ?? ""} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            B 站 UID
            <input name="bili_uid" inputMode="numeric" defaultValue={sp.uid ?? ""} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            直播间号
            <input name="bili_room_id" inputMode="numeric" defaultValue={sp.bili_room_id ?? ""} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm sm:col-span-2">
            一句话介绍
            <input name="intro" maxLength={200} className={`${input} mt-1 w-full`} />
          </label>
          <div className="sm:col-span-2">
            <button className={btnPrimary}>创建（invited）</button>
          </div>
        </form>
      </section>

      {/* 3. 列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">主播</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-fg/5 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2">handle</th>
                <th className="px-3 py-2">名字</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">邮箱</th>
                <th className="px-3 py-2">UID</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(streamers ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-mono">{s.handle}</td>
                  <td className="px-3 py-2">{s.display_name || "—"}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2 text-muted">{s.auth_email}</td>
                  <td className="px-3 py-2 font-mono text-muted">{s.bili_uid ?? "—"}</td>
                  <td className="px-3 py-2">
                    <form action={setStreamerStatus} className="flex gap-1">
                      <input type="hidden" name="id" value={s.id} />
                      {s.status === "hidden" ? (
                        <button name="status" value="active" className={btn}>
                          恢复
                        </button>
                      ) : (
                        <button name="status" value="hidden" className={btn}>
                          隐藏
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
