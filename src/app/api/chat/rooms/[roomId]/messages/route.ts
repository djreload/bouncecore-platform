import { NextResponse } from "next/server";
import { publicChatAction } from "@/app/chat/actions";
import { initialPublicChatActionState } from "@/app/chat/state";
import { getPublicChatMessages, getPublicChatPresence } from "@/lib/chat/chat-service";
import { getCurrentUser } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { roomId } = await context.params;

  try {
    const user = await getCurrentUser();
    const [messages, presenceUsers] = await Promise.all([
      getPublicChatMessages(roomId, user?.id),
      getPublicChatPresence(roomId, user?.id)
    ]);

    return NextResponse.json({ messages, presenceUsers });
  } catch {
    return NextResponse.json({ error: "Chat messages are not available right now." }, { status: 404 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message: "Chat request was not valid."
      },
      { status: 400 }
    );
  }

  formData.set("roomId", roomId);
  const result = await publicChatAction(initialPublicChatActionState, formData);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    },
    status: result.status === "success" ? 200 : 400
  });
}
