import { NextResponse } from "next/server";
import { getPublicChatMessages } from "@/lib/chat/chat-service";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { roomId } = await context.params;

  try {
    const messages = await getPublicChatMessages(roomId);

    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "Chat messages are not available right now." }, { status: 404 });
  }
}
