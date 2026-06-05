import { NextResponse } from "next/server";
import { requireInternalTaskAuth } from "@/lib/internal/task-auth";
import { validateRawStreamKey } from "@/lib/stream/stream-key-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    },
    status
  });
}

async function requestBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: Request) {
  const auth = requireInternalTaskAuth(request);

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const body = await requestBody(request);
  const streamKey = stringValue(body.streamKey ?? body.stream_key ?? body.key ?? body.password);

  if (!streamKey) {
    return jsonResponse(
      {
        reason: "missing_key",
        valid: false
      },
      400
    );
  }

  const result = await validateRawStreamKey(streamKey);

  return jsonResponse(result, result.valid ? 200 : 403);
}
