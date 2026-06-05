import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
