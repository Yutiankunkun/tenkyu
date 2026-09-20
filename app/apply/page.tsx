import { APPLY_FORM_URL } from "@/lib/site";

export const metadata = { title: "申请入驻" };

export default function ApplyPage() {
  return (
      <main className="mx-auto w-full max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold">申请入驻</h1>
        <div className="mt-4 space-y-3 leading-7 text-fg/85">
          <p>天球面向小体量的 VTuber。入驻是审核制：填写申请，我们会联系你确认后发送登录邀请。</p>
          <p>入驻后你只需要维护自己的每周直播时间表，就会得到一个可以贴在 B 站简介里的日程页面。</p>
          <p>不需要粉丝注册，不收费，不托管除日程以外的任何数据。</p>
        </div>
        <div className="mt-8">
          {APPLY_FORM_URL ? (
            <a
              href={APPLY_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-fg px-4 py-2 text-bg hover:opacity-90"
            >
              填写申请表
            </a>
          ) : (
            <p className="text-sm text-muted">申请表即将开放。</p>
          )}
        </div>
      </main>
  );
}
