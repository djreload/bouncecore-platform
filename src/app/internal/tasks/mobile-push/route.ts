import { NextResponse } from "next/server";
import { requireInternalTaskAuth } from "@/lib/internal/task-auth";
import { checkExpoMobilePushReceipts, processQueuedMobilePushDeliveries } from "@/lib/mobile/push-dispatch-service";

export const dynamic = "force-dynamic";

type MobilePushTaskMode = "both" | "dispatch" | "receipts";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    },
    status
  });
}

function normalizedMode(value: unknown): MobilePushTaskMode {
  return value === "dispatch" || value === "receipts" || value === "both" ? value : "both";
}

function normalizedLimit(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

async function requestBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function POST(request: Request) {
  const auth = requireInternalTaskAuth(request);

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const url = new URL(request.url);
  const body = await requestBody(request);
  const mode = normalizedMode(body.mode ?? url.searchParams.get("mode"));
  const limit = normalizedLimit(body.limit ?? url.searchParams.get("limit"));
  const startedAt = new Date();
  const receiptResult =
    mode === "both" || mode === "receipts" ? await checkExpoMobilePushReceipts(null, limit) : null;
  const dispatchResult =
    mode === "both" || mode === "dispatch" ? await processQueuedMobilePushDeliveries(null, limit) : null;

  return jsonResponse({
    dispatch: dispatchResult,
    finishedAt: new Date().toISOString(),
    mode,
    receipts: receiptResult,
    startedAt: startedAt.toISOString()
  });
}
