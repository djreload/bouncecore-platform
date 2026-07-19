import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getDirectMessagingData,
  sendDirectMessage,
  startDirectConversation
} from "@/lib/messages/direct-message-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
    status
  });
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size ? value : null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Sign in to read private messages." }, 401);
  }

  try {
    const conversationId = new URL(request.url).searchParams.get("conversation");
    return noStoreJson(await getDirectMessagingData(user.id, conversationId));
  } catch {
    return noStoreJson({ error: "Private messages are not available right now." }, 500);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Sign in to send private messages." }, 401);
  }

  try {
    const formData = await request.formData();
    const intent = formString(formData, "intent");

    if (intent === "start") {
      const conversation = await startDirectConversation(user.id, formString(formData, "targetUserId"));
      return noStoreJson({ conversationId: conversation.id, status: "success" });
    }

    if (intent === "send") {
      const conversationId = formString(formData, "conversationId");
      const message = await sendDirectMessage({
        body: formData.get("body"),
        conversationId,
        file: formFile(formData, "file"),
        senderUserId: user.id
      });

      return noStoreJson({ conversationId, messageId: message.id, status: "success" });
    }

    return noStoreJson({ error: "Private message action was not recognized." }, 400);
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Private message could not be sent." }, 400);
  }
}
