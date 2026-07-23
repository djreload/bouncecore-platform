import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb"
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
  reactStrictMode: true,
  async headers() {
    return [
      {
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }
        ],
        source: "/:path*"
      }
    ];
  }
};

export default nextConfig;
