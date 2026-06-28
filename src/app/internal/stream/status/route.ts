import { NextResponse } from "next/server";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";

export async function GET() {
  const liveState = await getPublicLiveState();

  return NextResponse.json({
    status: liveState.status,
    health: liveState.health,
    activeIngests: liveState.activeIngests,
    offlineImageUrl: liveState.offlineImageUrl,
    playbackUrl: liveState.playbackUrl,
    viewerCount: liveState.viewerCount,
    channel: liveState.channel,
    provider: liveState.provider
  });
}
