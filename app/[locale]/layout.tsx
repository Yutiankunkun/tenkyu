import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { LOCALES, getMessages, isLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/client";
import "../globals.css";

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

// Applies the stored theme before first paint (dark is the default). Kept tiny and inline
// on purpose: a React effect would flash the default theme first.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("tenkyu:theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();`;

type Params = Promise<{ locale: string }>;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(isLocale(locale) ? locale : "zh-CN");
  return {
    title: { default: m.site.name, template: m.site.titleTemplate },
    description: m.site.description,
    metadataBase: new URL("https://tenkyu.app"),
    openGraph: { siteName: m.site.name, type: "website", locale: locale === "en" ? "en_US" : "zh_CN" },
  };
}

export const viewport: Viewport = {
  themeColor: "#006fb9",
};

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Params }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} data-theme="dark" className={`${notoSC.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <LocaleProvider locale={locale} messages={getMessages(locale)}>
          {children}
        </LocaleProvider>
        <Analytics />
      </body>
    </html>
  );
}
