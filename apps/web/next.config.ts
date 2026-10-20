import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@devrelay/core", "@devrelay/integrations"],
};

export default nextConfig;
