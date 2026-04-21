import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProduction ? { devIndicators: false } : {}),
};

export default nextConfig;
