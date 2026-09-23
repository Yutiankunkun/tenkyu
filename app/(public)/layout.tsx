import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Public side: the observatory board, watch pages, check and about pages. No auth, no login links.
export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
