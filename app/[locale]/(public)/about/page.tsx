import type { Metadata } from "next";
import Link from "next/link";
import { fmt, getMessages, isLocale, localePath, type Locale } from "@/lib/i18n";
import { LEVEL_GATE } from "@/lib/stars-shared";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getMessages(isLocale(locale) ? locale : "zh-CN").about.metaTitle };
}

export default async function AboutPage({ params }: { params: Params }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "zh-CN") as Locale;
  const m = getMessages(locale);
  const vars = { gate: LEVEL_GATE };
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{m.about.title}</h1>
      <div className="mt-4 space-y-4 leading-7 text-fg/85">
        <p>{m.about.intro}</p>
        {m.about.sections.map((s) => (
          <section key={s.h} className="space-y-3">
            <h2 className="pt-2 text-lg font-semibold">{fmt(s.h, vars)}</h2>
            {s.p.map((p) => (
              <p key={p.slice(0, 24)}>{fmt(p, vars)}</p>
            ))}
          </section>
        ))}
        <h2 className="pt-2 text-lg font-semibold">{m.about.checkTitle}</h2>
        <p>
          {m.about.checkText1}
          <Link href={localePath(locale, "/check")} className="underline">
            {m.about.checkLink}
          </Link>
          {m.about.checkText2}
        </p>
        <h2 className="pt-2 text-lg font-semibold">{m.about.privacyTitle}</h2>
        {m.about.privacy.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </main>
  );
}
