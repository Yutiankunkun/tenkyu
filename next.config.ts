import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: public reads are cached with `use cache` + cacheTag and
  // invalidated from server actions with updateTag (see lib/schedule.ts).
  cacheComponents: true,
};

export default nextConfig;
