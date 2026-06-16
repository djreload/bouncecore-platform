import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "120mb"
    }
  },
  images: {
    remotePatterns: [
      {
        hostname: "media.tenor.com",
        protocol: "https"
      },
      {
        hostname: "c.tenor.com",
        protocol: "https"
      }
    ]
  },
  poweredByHeader: false,
  reactStrictMode: true
};

export default nextConfig;
