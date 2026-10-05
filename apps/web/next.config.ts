import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the dev-tools indicator badge. Build/runtime errors still surface.
  devIndicators: false,
  // @sllights/shared ships TypeScript source (no build step), so Next
  // compiles it alongside the app.
  transpilePackages: ["@sllights/shared"],
  // Dev only: lets phones/emulators on the LAN load hot-reload and other
  // dev resources (e.g. http://172.16.50.127:3000). Ignored by `next build`.
  // Set ALLOWED_DEV_ORIGINS in .env.local, comma-separated.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export default nextConfig;
