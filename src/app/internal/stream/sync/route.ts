import { NextResponse } from "next/server";
import { requireInternalTaskAuth } from "@/lib/internal/task-auth";
import { syncStreamProviderSnapshot } from "@/lib/stream/stream-session-sync-service";

export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    },
    status
  });
}

export async function POST(request: Request) {
  const auth = requireInternalTaskAuth(request);

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const startedAt = new Date();
  const result = await syncStreamProviderSnapshot();

  return jsonResponse({
    finishedAt: new Date().toISOString(),
    result,
    startedAt: startedAt.toISOString()
  });
}
