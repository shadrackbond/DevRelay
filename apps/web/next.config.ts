import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["0.0.0.0", "10.1.3.112"],
  transpilePackages: ["@devrelay/core"],
};

export default nextConfig;
