import { NextResponse } from "next/server";
import { subscribeToChatRoomChanges } from "@/lib/chat/chat-realtime";
import {
  getPublicChatMessages,
  getPublicChatPresence,
  getPublicChatRoom,
  type ChatMessageSummary,
  type ChatPresenceUserSummary,
  type ChatRoomSummary
} from "@/lib/chat/chat-service";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

const chatStreamPollMs = 2500;
const chatStreamConsistencyPollMs = 30000;
const chatStreamHeartbeatMs = 15000;
const encoder = new TextEncoder();

function encodeServerEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function encodeServerComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

function messageSignature(messages: ChatMessageSummary[]) {
  const latestMessage = messages.at(-1);
  const reactionSignature = messages
    .map((message) =>
      `${message.id}:${message.editedAt ?? ""}:${message.body}:${message.effectId ?? ""}:${message.authorAvatarUrl ?? ""}:${message.reactions.map((reaction) => `${reaction.key}-${reaction.count}-${reaction.reacted ? "1" : "0"}`).join(",")}`
    )
    .join("|");

  return `${messages.length}:${latestMessage?.id ?? "empty"}:${latestMessage?.createdAt ?? ""}:${reactionSignature}`;
}

function roomSignature(room: ChatRoomSummary | null) {
  return `${room?.id ?? "missing"}:${room?.lockedAt ?? "unlocked"}:${room?.slowModeSeconds ?? 0}`;
}

function presenceSignature(presenceUsers: ChatPresenceUserSummary[]) {
  return presenceUsers.map((user) => `${user.id}:${user.status}:${user.avatarUrl ?? ""}:${user.throwHitCount}`).join("|");
}

function waitForNextPoll(signal: AbortSignal, timeoutMs: number) {
  return new Promise<"abort" | "timeout">((resolve) => {
    if (signal.aborted) {
      resolve("abort");
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve("timeout");
    }, timeoutMs);

    function onAbort() {
      clearTimeout(timer);
      resolve("abort");
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function createRefreshSignal(signal: AbortSignal) {
  let pending = false;
  let wake: (() => void) | null = null;

  return {
    notify() {
      pending = true;
      wake?.();
    },
    wait(timeoutMs: number) {
      return new Promise<"abort" | "notify" | "timeout">((resolve) => {
        if (signal.aborted) {
          resolve("abort");
          return;
        }

        if (pending) {
          pending = false;
          resolve("notify");
          return;
        }

        const timer = setTimeout(() => {
          cleanup();
          resolve("timeout");
        }, timeoutMs);

        function cleanup() {
          clearTimeout(timer);
          signal.removeEventListener("abort", onAbort);

          if (wake === onNotify) {
            wake = null;
          }
        }

        function onAbort() {
          cleanup();
          resolve("abort");
        }

        function onNotify() {
          pending = false;
          cleanup();
          resolve("notify");
        }

        wake = onNotify;
        signal.addEventListener("abort", onAbort, { once: true });
      });
    }
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  const currentUser = await getCurrentUser();

  let initialMessages: ChatMessageSummary[];
  let initialRoom: ChatRoomSummary | null;
  let initialPresenceUsers: ChatPresenceUserSummary[];

  try {
    [initialMessages, initialRoom, initialPresenceUsers] = await Promise.all([
      getPublicChatMessages(roomId, currentUser?.id),
      getPublicChatRoom(roomId),
      getPublicChatPresence(roomId, currentUser?.id)
    ]);
  } catch {
    return NextResponse.json({ error: "Chat stream is not available right now." }, { status: 404 });
  }

  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      let lastSignature = messageSignature(initialMessages);
      let lastRoomSignature = roomSignature(initialRoom);
      let lastPresenceSignature = presenceSignature(initialPresenceUsers);
      let lastHeartbeatAt = Date.now();
      const refreshSignal = createRefreshSignal(request.signal);

      function enqueue(chunk: Uint8Array) {
        if (cancelled || request.signal.aborted) {
          return false;
        }

        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          cancelled = true;
          return false;
        }
      }

      enqueue(encodeServerEvent("messages", { messages: initialMessages }));
      enqueue(encodeServerEvent("room", { room: initialRoom }));
      enqueue(encodeServerEvent("presence", { presenceUsers: initialPresenceUsers }));

      async function pumpMessages() {
        const unsubscribe = await subscribeToChatRoomChanges(roomId, refreshSignal.notify).catch(() => null);
        const refreshIntervalMs = unsubscribe
          ? Math.min(chatStreamConsistencyPollMs, chatStreamHeartbeatMs)
          : chatStreamPollMs;

        while (!cancelled && !request.signal.aborted) {
          const reason = unsubscribe
            ? await refreshSignal.wait(refreshIntervalMs)
            : await waitForNextPoll(request.signal, refreshIntervalMs);

          if (reason === "abort" || cancelled || request.signal.aborted) {
            break;
          }

          try {
            const [messages, room, presenceUsers] = await Promise.all([
              getPublicChatMessages(roomId, currentUser?.id),
              getPublicChatRoom(roomId),
              getPublicChatPresence(roomId, currentUser?.id)
            ]);
            const nextSignature = messageSignature(messages);
            const nextRoomSignature = roomSignature(room);
            const nextPresenceSignature = presenceSignature(presenceUsers);

            if (nextRoomSignature !== lastRoomSignature) {
              if (!enqueue(encodeServerEvent("room", { room }))) {
                break;
              }

              lastRoomSignature = nextRoomSignature;
              lastHeartbeatAt = Date.now();
            }

            if (nextPresenceSignature !== lastPresenceSignature) {
              if (!enqueue(encodeServerEvent("presence", { presenceUsers }))) {
                break;
              }

              lastPresenceSignature = nextPresenceSignature;
              lastHeartbeatAt = Date.now();
            }

            if (nextSignature !== lastSignature) {
              if (!enqueue(encodeServerEvent("messages", { messages }))) {
                break;
              }

              lastSignature = nextSignature;
              lastHeartbeatAt = Date.now();
              continue;
            }

            if (Date.now() - lastHeartbeatAt >= chatStreamHeartbeatMs) {
              if (!enqueue(encodeServerComment("keep-alive"))) {
                break;
              }

              lastHeartbeatAt = Date.now();
            }
          } catch {
            enqueue(encodeServerEvent("error", { error: "Chat stream closed." }));
            break;
          }
        }

        await unsubscribe?.().catch(() => {
          // The browser can close the stream while Redis unsubscribe is in flight.
        });

        try {
          controller.close();
        } catch {
          // The browser can close the stream between polls.
        }
      }

      void pumpMessages();
    },
    cancel() {
      cancelled = true;
      // The request abort signal stops the polling loop.
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}
