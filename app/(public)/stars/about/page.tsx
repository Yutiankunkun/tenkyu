import Link from "next/link";
import { LEVEL_GATE } from "@/lib/stars";

export const metadata = { title: "观星台 · 我们怎么选" };

export default function StarsAboutPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">观星台怎么选主播</h1>
      <div className="mt-4 space-y-4 leading-7 text-fg/85">
        <p>观星台列出的是此刻正在 B 站虚拟主播分区直播的主播，数据来自 B 站的公开接口，约每 10 分钟更新一次。它不是推荐榜，也不做任何排名以外的判断。</p>
        <h2 className="pt-2 text-lg font-semibold">只收账号等级 {LEVEL_GATE} 级以上</h2>
        <p>
          我们只展示账号等级达到 {LEVEL_GATE} 级的主播。等级是 B 站根据账号日常使用累积的公开信息，达到 {LEVEL_GATE} 级通常意味着这个账号在开播之前就已经正常使用了一段时间。它是一个客观门槛，不是对任何人的评价：不达标的主播只是不出现在这里，我们不会给任何人贴标签。
        </p>
        <h2 className="pt-2 text-lg font-semibold">这不是承诺</h2>
        <p>任何主播都可能停播或离开。观星台展示的只是公开事实，请自行判断，理性投入。</p>
        <h2 className="pt-2 text-lg font-semibold">什么时候会消失</h2>
        <p>下播后会在下一次更新时从列表移除；账号注销或查询不到时会被自动清理，包括已入驻主播的日程页。</p>
        <h2 className="pt-2 text-lg font-semibold">查询与下架</h2>
        <p>
          想知道自己（或你运营的主播）在不在观星台、为什么在或不在，可以
          <Link href="/stars/check" className="underline">
            用房间号或 UID 查一查
          </Link>
          。本人或运营不希望被列出，也从那里提出下架，我们确认后处理；纠错同样从那里提。我们按善意假设运营，不接受第三方代为申请下架。
        </p>
        <h2 className="pt-2 text-lg font-semibold">主播可以做什么</h2>
        <p>
          出现在这里不需要任何操作。如果你想有一个自己维护的日程页，并在卡片上显示「已入驻」，可以
          <Link href="/studio/apply" className="underline">
            申请入驻
          </Link>
          。入驻是审核制，不收费。
        </p>
      </div>
    </main>
  );
}
