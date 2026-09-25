import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites-view";
import { getMessages, isLocale } from "@/lib/i18n";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getMessages(isLocale(locale) ? locale : "zh-CN").favorites.metaTitle };
}

// Favourites live in the browser only, so the page is a client view over two small APIs.
export default function FavoritesPage() {
  return (
    <div className="px-4 py-4">
      <FavoritesView />
    </div>
  );
}
