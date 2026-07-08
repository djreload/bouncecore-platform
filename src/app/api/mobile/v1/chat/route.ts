import { NextResponse } from "next/server";
import { createChatGifMessage, createChatMessage } from "@/lib/chat/chat-service";
import { getMobileChatPayload } from "@/lib/mobile/public-api";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { mobileActionError } from "@/lib/mobile/responses";
import { createLiveChatStarSend } from "@/lib/stars/star-send-service";

export const dynamic = "force-dynamic";

function firstParam(value: string | null) {
  return value?.trim() || undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    return NextResponse.json(await getMobileChatPayload(firstParam(url.searchParams.get("room"))));
  } catch {
    return NextResponse.json({ error: "Chat data is not available right now." }, { status: 500 });
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function bodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function bodyNumber(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => null);

    if (!isObject(payload)) {
      return NextResponse.json({ error: "Send a JSON chat payload." }, { status: 400 });
    }

    const roomId = bodyString(payload, "roomId");
    const intent = bodyString(payload, "intent") || "text";

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required." }, { status: 400 });
    }

    if (intent === "gif") {
      const gif = isObject(payload.gif) ? payload.gif : payload;
      const message = await createChatGifMessage(roomId, user.id, {
        alt: bodyString(gif, "alt") || bodyString(gif, "title"),
        height: bodyNumber(gif, "height"),
        id: bodyString(gif, "id"),
        previewUrl: bodyString(gif, "previewUrl"),
        provider: bodyString(gif, "provider"),
        searchTerm: bodyString(payload, "searchTerm") || bodyString(gif, "searchTerm"),
        url: bodyString(gif, "url"),
        width: bodyNumber(gif, "width")
      });

      return NextResponse.json({ id: message.id, kind: message.kind, ok: true });
    }

    if (intent === "stars") {
      const result = await createLiveChatStarSend(roomId, user.id, {
        amount: bodyString(payload, "amount"),
        note: bodyString(payload, "note")
      });

      return NextResponse.json({ kind: "stars", ok: true, sendId: result.sendId });
    }

    if (intent !== "text") {
      return NextResponse.json({ error: "intent must be text, gif, or stars." }, { status: 400 });
    }

    const message = await createChatMessage(
      roomId,
      bodyString(payload, "body"),
      user.id,
      bodyString(payload, "effectId"),
      bodyString(payload, "replyToMessageId")
    );

    return NextResponse.json({ id: message.id, kind: message.kind, ok: true });
  } catch (error) {
    return mobileActionError(error, "Chat message could not be sent.");
  }
}
