import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";
import { getMessages, isLocale } from "@/lib/i18n";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getMessages(isLocale(locale) ? locale : "zh-CN").settings.metaTitle };
}

// Every setting is browser-local, so the page is a client view.
export default function SettingsPage() {
  return <SettingsView />;
}
