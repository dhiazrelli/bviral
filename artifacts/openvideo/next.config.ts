import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["express", "@genkit-ai/core", "genkit"],
};

export default nextConfig;
