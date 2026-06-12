import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deno Deploy runs `next build` via Deno workers; limit parallelism to avoid
  // missing webpack chunk errors during "Collecting page data".
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 3,
  },
};

export default nextConfig;
