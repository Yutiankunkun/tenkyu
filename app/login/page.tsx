import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { requestMagicLink } from "./actions";

export const metadata = { title: "主播登录" };

type SP = Promise<{ sent?: string; error?: string }>;

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold">主播登录</h1>
        <p className="mt-2 text-sm text-neutral-500">
          入驻为审核制。输入受邀邮箱，登录链接会发到邮箱里。
        </p>
        <Suspense fallback={null}>
          <Notice searchParams={searchParams} />
        </Suspense>
        <form action={requestMagicLink} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">邮箱</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
          >
            发送登录链接
          </button>
        </form>
      </main>
    </>
  );
}

async function Notice({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  if (sp.sent) {
    return (
      <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        如果该邮箱已受邀，登录链接已发送，请查收邮件（也看一下垃圾箱）。
      </p>
    );
  }
  if (sp.error) {
    const msg =
      sp.error === "email"
        ? "邮箱格式不对。"
        : sp.error === "send"
          ? "发送失败，请稍后再试。"
          : sp.error === "callback"
            ? "登录链接无效或已过期，请重新发送。"
            : "服务器开小差了，请稍后再试。";
    return (
      <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
        {msg}
      </p>
    );
  }
  return null;
}
