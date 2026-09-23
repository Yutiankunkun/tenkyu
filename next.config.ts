import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: public reads are cached with `use cache` + cacheTag and
  // invalidated from server actions with updateTag (see lib/schedule.ts).
  cacheComponents: true,
  // 2026-09-23: the streamer side moved under /studio. Old links (magic-link emails,
  // bookmarks, the 周报图 footer) keep working.
  async redirects() {
    return ["login", "edit", "admin", "apply"].map((p) => ({
      source: `/${p}`,
      destination: `/studio/${p}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
