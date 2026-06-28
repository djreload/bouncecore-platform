import { NextResponse } from "next/server";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { publicLiveStateToStatusPayload } from "@/lib/stream/live-status-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const liveState = await getPublicLiveState();

  return NextResponse.json(publicLiveStateToStatusPayload(liveState), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
