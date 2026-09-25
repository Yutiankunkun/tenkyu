import type { Metadata } from "next";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getMessages(isLocale(locale) ? locale : "zh-CN").privacy.metaTitle };
}

export default async function PrivacyPage({ params }: { params: Params }) {
  const { locale } = await params;
  const m = getMessages((isLocale(locale) ? locale : "zh-CN") as Locale);
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{m.privacy.title}</h1>
      <div className="mt-4 space-y-3 leading-7 text-fg/85">
        {m.privacy.p.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </main>
  );
}
