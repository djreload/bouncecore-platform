import { NextResponse } from "next/server";
import { getRequestTokenHash, touchSessionActivity } from "@/lib/auth/session";
import { recordLiveViewerHeartbeat } from "@/lib/presence/live-viewer-presence";

export const dynamic = "force-dynamic";

async function readPresencePayload(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const [payload, touched] = await Promise.all([readPresencePayload(request), touchSessionActivity(await getRequestTokenHash())]);
    const liveViewerRecorded = await recordLiveViewerHeartbeat({
      liveViewer: payload.liveViewer === true,
      path: payload.path,
      visitorId: payload.visitorId
    });

    return NextResponse.json({
      ok: true,
      active: touched > 0,
      liveViewerRecorded
    });
  } catch {
    return NextResponse.json({
      ok: false,
      active: false,
      liveViewerRecorded: false
    });
  }
}
