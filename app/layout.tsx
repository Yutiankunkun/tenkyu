import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TzProvider } from "@/components/tz-provider";
import "./globals.css";

// Downloaded at build time and served from our own domain (/_next/static/media),
// so mainland visitors never touch Google. preload off: CJK ships as many
// unicode-range slices; the browser fetches only what a page uses.
const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sc",
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "天球 Tenkyu",
    template: "%s · 天球 Tenkyu",
  },
  description: "小体量 VTuber 的本周直播时间表",
  metadataBase: new URL("https://tenkyu.app"),
  openGraph: { siteName: "天球 Tenkyu", type: "website", locale: "zh_CN" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${notoSC.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <TzProvider>{children}</TzProvider>
        <Analytics />
      </body>
    </html>
  );
}
