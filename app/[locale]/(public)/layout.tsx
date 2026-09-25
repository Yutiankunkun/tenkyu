import { AppShell } from "@/components/app-shell";

// Public side: the observatory board, favourites, watch pages, check and about pages.
// No auth anywhere. The shell (app bar, drawer, bottom nav) is the Holodex skeleton.
export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
