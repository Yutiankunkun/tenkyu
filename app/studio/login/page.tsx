import { Suspense } from "react";
import { requestMagicLink } from "./actions";

export const metadata = { title: "主播登录" };

type SP = Promise<{ sent?: string; error?: string }>;

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold">主播登录</h1>
        <p className="mt-2 text-sm text-muted">
          入驻为审核制。输入受邀邮箱，登录链接会发到邮箱里。
        </p>
        <Suspense fallback={null}>
          <Notice searchParams={searchParams} />
        </Suspense>
        <form action={requestMagicLink} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="text-muted">邮箱</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-fg px-3 py-2 text-bg hover:opacity-90"
          >
            发送登录链接
          </button>
        </form>
      </main>
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
        : sp.error === "ratelimit"
          ? "请求太频繁。上一封登录邮件可能已经发出，请先查收邮箱；1 分钟后才能再发一封。"
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
