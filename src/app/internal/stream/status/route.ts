import { NextResponse } from "next/server";
import { getStreamProvider } from "@/lib/stream/stream-provider";

export async function GET() {
  const provider = getStreamProvider();
  const [status, health, playbackUrl, viewerCount] = await Promise.all([
    provider.getStreamStatus(),
    provider.getStreamHealth(),
    provider.getPlaybackUrl(),
    provider.getViewerCount()
  ]);

  return NextResponse.json({
    status,
    health,
    playbackUrl,
    viewerCount
  });
}
