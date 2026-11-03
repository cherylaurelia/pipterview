import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  /* config options here */
  // the old 2D pages are gone; links to them land on the island, which does all of it now
  async redirects() {
    return ["/interview/:type", "/progress", "/review"].map((source) => ({ source, destination: "/", permanent: false }));
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
