import type { NextConfig } from "next";
import { HIDDEN_INTERVIEW_TYPE_IDS } from "./src/lib/interview/types";

const nextConfig: NextConfig = {
  /* config options here */
  // hidden round types (system design, for now) send anyone who opens their room back to the island
  async redirects() {
    return HIDDEN_INTERVIEW_TYPE_IDS.map((type) => ({ source: `/interview/${type}`, destination: "/", permanent: false }));
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
