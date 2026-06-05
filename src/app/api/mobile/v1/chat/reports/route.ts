import { NextResponse } from "next/server";
import { createChatReport } from "@/lib/chat/moderation-service";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { mobileActionError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function bodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => null);

    if (!isObject(payload)) {
      return NextResponse.json({ error: "Send a JSON report payload." }, { status: 400 });
    }

    const report = await createChatReport(
      {
        messageId: bodyString(payload, "messageId"),
        notes: bodyString(payload, "notes"),
        reason: bodyString(payload, "reason")
      },
      user.id
    );

    return NextResponse.json({
      id: report.id,
      ok: true,
      status: report.status
    });
  } catch (error) {
    return mobileActionError(error, "Chat report could not be sent.");
  }
}
