import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    app: "Bouncecore",
    apiVersion: "mobile-v1",
    environment: process.env.NODE_ENV ?? "development",
    features: {
      live: true,
      chat: true,
      shop: true,
      music: true,
      rewards: true,
      ads: false
    },
    theme: {
      mode: "dark",
      accent: "electric-cyan"
    }
  });
}
