
export const metadata = { title: "隐私说明" };

export default function PrivacyPage() {
  return (
      <main className="mx-auto w-full max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold">隐私说明</h1>
        <div className="mt-4 space-y-3 leading-7 text-fg/85">
          <p>天球只存储入驻主播自己填写的公开资料和直播时间表，以及用于登录的邮箱地址。</p>
          <p>粉丝无需注册。你在浏览器里选择的主播只保存在你自己的浏览器中，不会上传。</p>
          <p>
            站点使用 Vercel Web Analytics 统计访问量。它不使用 Cookie，不跨站点追踪，也不记录可识别个人的信息。
          </p>
          <p>主播可以随时要求下线并删除自己的全部数据。</p>
        </div>
      </main>
  );
}
