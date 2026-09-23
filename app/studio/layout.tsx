import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { StudioHeader } from "@/components/studio-header";

// Streamer side (入驻): login, editor, 周报图, apply, admin. Its own header; the public
// navigation never appears here, and public pages never link here except 「申请入驻」.
export const metadata: Metadata = {
  title: { default: "天球 · 入驻", template: "%s · 天球入驻" },
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <StudioHeader />
      {children}
      <SiteFooter />
    </>
  );
}
