import { NextResponse } from "next/server";
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
