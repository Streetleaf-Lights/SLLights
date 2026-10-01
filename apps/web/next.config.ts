import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the dev-tools indicator badge. Build/runtime errors still surface.
  devIndicators: false,
  // @sllights/shared ships TypeScript source (no build step), so Next
  // compiles it alongside the app.
  transpilePackages: ["@sllights/shared"],
};

export default nextConfig;
