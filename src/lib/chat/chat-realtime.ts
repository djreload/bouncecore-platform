import { publishRealtimeEvent, subscribeRealtimeEvent, type RealtimeUnsubscribe } from "@/lib/realtime/redis";

type ChatRoomChangedPayload = {
  changedAt: string;
  messageId?: string;
  roomId: string;
  type: "messages.changed";
};

function chatRoomChannel(roomId: string) {
  return `chat:room:${roomId}:messages`;
}

export async function publishChatRoomChanged(roomId: string, messageId?: string) {
  const payload: ChatRoomChangedPayload = {
    changedAt: new Date().toISOString(),
    ...(messageId ? { messageId } : {}),
    roomId,
    type: "messages.changed"
  };

  return publishRealtimeEvent(chatRoomChannel(roomId), JSON.stringify(payload));
}

export async function subscribeToChatRoomChanges(roomId: string, onChange: () => void): Promise<RealtimeUnsubscribe | null> {
  return subscribeRealtimeEvent(chatRoomChannel(roomId), (message) => {
    try {
      const payload = JSON.parse(message) as Partial<ChatRoomChangedPayload>;

      if (payload.type === "messages.changed" && payload.roomId === roomId) {
        onChange();
      }
    } catch {
      onChange();
    }
  });
}
