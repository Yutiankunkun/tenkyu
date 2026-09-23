import Link from "next/link";
import { LEVEL_GATE } from "@/lib/stars";

export const metadata = { title: "观星台 · 我们怎么选" };

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">观星台怎么选主播</h1>
      <div className="mt-4 space-y-4 leading-7 text-fg/85">
        <p>
          观星台列出的是此刻正在 B 站虚拟主播分区直播的主播，数据来自 B 站的公开接口，约每 10 分钟更新一次。它是为找到小体量主播而做的，不是人气榜，也不对任何人做排名以外的判断。
        </p>

        <h2 className="pt-2 text-lg font-semibold">只收账号等级 {LEVEL_GATE} 级以上</h2>
        <p>
          等级是 B 站根据账号日常使用累积的公开信息，每天能拿的经验有上限，所以等级只能用时间换，达到 {LEVEL_GATE} 级通常意味着账号在开播前就已经正常使用了一段时间。它是一个客观门槛，不是对任何人的评价：不达标的主播只是不出现在这里。
        </p>

        <h2 className="pt-2 text-lg font-semibold">「在线」是什么</h2>
        <p>
          卡片和观看页上的「在线 N」是 B 站直播间高能榜上方显示的登录用户在线数。它不含未登录的观众，所以比真实人数偏低，但它是公开接口里最诚实的数字。我们从不显示人气值：人气值可以用人气票买到，和有多少人在看没有关系。在线数约每 10 分钟更新一轮，观看页上约每分钟更新。
        </p>
        <p>
          在线 10 人以内的直播间不再细分。1 个人和 5 个人没有区别，都是值得走进去的房间。
        </p>

        <h2 className="pt-2 text-lg font-semibold">「观测 N 周」是什么</h2>
        <p>
          观星台从 2026 年 9 月下旬开始记录每个直播间的开播。「观测 N 周」表示最近 26 周里，有 N 个星期我们至少看到她播过一次。一个星期最多记一次，播得再多也不加分。我们奖励的不是勤奋，是「下周她还在」。
        </p>

        <h2 className="pt-2 text-lg font-semibold">默认顺序怎么排</h2>
        <p>
          综合排序先按观测周数分层，观测久的在前；同一层内的顺序是随机的，每 10 分钟重洗一次，长期看每个直播间的曝光是均等的；在线 0 人的直播间排在最后。没有任何指标奖励开播次数或时长。你也可以改成按在线少、粉丝少或刚开播排序。
        </p>

        <h2 className="pt-2 text-lg font-semibold">我们不做什么</h2>
        <p>不给任何人贴负面标签，不做举报，不做黑名单。页面上没有任何打赏入口，观看页用的是 B 站官方的嵌入播放器，发弹幕和上舰请去直播间。</p>

        <h2 className="pt-2 text-lg font-semibold">这不是承诺</h2>
        <p>任何主播都可能停播或离开。观星台展示的只是公开事实，请自行判断，理性投入。</p>

        <h2 className="pt-2 text-lg font-semibold">什么时候会消失</h2>
        <p>下播后会在下一次更新时从列表移除；账号注销或查询不到时会被自动清理。</p>

        <h2 className="pt-2 text-lg font-semibold">查询与下架</h2>
        <p>
          想知道自己（或你运营的主播）在不在观星台、为什么在或不在，可以
          <Link href="/check" className="underline">
            用房间号或 UID 查一查
          </Link>
          。本人或运营不希望被列出，也从那里提出下架，我们确认后处理；纠错同样从那里提。我们按善意假设运营，不接受第三方代为申请下架。
        </p>
      </div>
    </main>
  );
}
