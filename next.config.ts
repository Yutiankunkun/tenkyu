import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: public reads are cached with `use cache` + cacheTag and
  // invalidated from server actions with updateTag (see lib/schedule.ts).
  cacheComponents: true,
  // Retired paths (schedule editor, onboarding, merged view) and the old /stars prefix.
  async redirects() {
    const gone = ["login", "edit", "admin", "apply", "w", "studio", "studio/:path*", "data/:path*"];
    return [
      { source: "/stars", destination: "/", permanent: true },
      { source: "/stars/about", destination: "/about", permanent: true },
      { source: "/stars/check", destination: "/check", permanent: true },
      { source: "/privacy", destination: "/about", permanent: true },
      { source: "/en/privacy", destination: "/en/about", permanent: true },
      ...gone.map((p) => ({ source: "/" + p, destination: "/", permanent: true })),
    ];
  },
};

export default nextConfig;
