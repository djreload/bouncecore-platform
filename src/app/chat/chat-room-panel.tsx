"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { publicChatAction } from "@/app/chat/actions";
import {
  initialPublicChatActionState,
  type PublicChatActionState,
  type PublicChatMessageRow,
  type PublicChatRoomRow,
  type PublicChatUser
} from "@/app/chat/state";

type ChatRoomPanelProps = {
  rooms: PublicChatRoomRow[];
  selectedRoom: PublicChatRoomRow | null;
  messages: PublicChatMessageRow[];
  currentUser: PublicChatUser | null;
  compact?: boolean;
  showRoomLinks?: boolean;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function roomTone(type: string) {
  if (type === "live") {
    return "acid" as const;
  }

  if (type === "vip") {
    return "pink" as const;
  }

  return "cyan" as const;
}

function roleTone(role: string) {
  if (role === "owner") {
    return "pink" as const;
  }

  if (role === "admin" || role === "moderator") {
    return "amber" as const;
  }

  if (role === "streamer" || role === "producer") {
    return "cyan" as const;
  }

  return "muted" as const;
}

export function ChatRoomPanel({
  rooms,
  selectedRoom,
  messages,
  currentUser,
  compact = false,
  showRoomLinks = true
}: ChatRoomPanelProps) {
  const [state, formAction, pending] = useActionState<PublicChatActionState, FormData>(
    publicChatAction,
    initialPublicChatActionState
  );

  return (
    <section className="rounded-md border border-bc-line bg-bc-panel">
      <div className="border-b border-bc-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone={selectedRoom ? roomTone(selectedRoom.type) : "muted"}>{selectedRoom?.type ?? "Chat"}</Badge>
            <h2 className={`${compact ? "text-xl" : "text-2xl"} mt-3 font-black`}>{selectedRoom?.name ?? "Chat rooms"}</h2>
            <p className="mt-1 text-sm text-bc-muted">
              {selectedRoom ? `${messages.length} visible messages in #${selectedRoom.slug}.` : "Create rooms from admin to start chat."}
            </p>
          </div>
          {currentUser ? <Badge tone="acid">{currentUser.displayName}</Badge> : null}
        </div>

        {showRoomLinks && rooms.length ? (
          <nav className="mt-4 flex flex-wrap gap-2">
            {rooms.map((room) => (
              <Link
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  selectedRoom?.id === room.id
                    ? "border-bc-electric/45 bg-bc-electric/10 text-white"
                    : "border-bc-line bg-bc-ink text-bc-muted hover:text-white"
                }`}
                href={`/chat?room=${room.slug}`}
                key={room.id}
              >
                #{room.slug}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <div className={`${compact ? "max-h-[380px]" : "max-h-[560px]"} overflow-y-auto p-4`}>
        <div className="space-y-3">
          {messages.map((message) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-3" key={message.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{message.authorDisplayName}</span>
                  {message.authorRoles.slice(0, 2).map((role) => (
                    <Badge className="py-0.5" key={role} tone={roleTone(role)}>
                      {role}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-bc-muted">{formatTime(message.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">{message.body}</p>
            </article>
          ))}
          {!messages.length ? (
            <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-bc-line bg-bc-ink p-6 text-center">
              <div>
                <MessageSquare className="mx-auto h-7 w-7 text-bc-electric" aria-hidden="true" />
                <p className="mt-3 text-sm text-bc-muted">
                  {selectedRoom ? "No messages yet. Start the room off." : "No chat rooms are configured yet."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-bc-line p-4">
        {state.message ? (
          <div
            className={`mb-3 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {currentUser && selectedRoom ? (
          <form action={formAction} className="grid gap-3">
            <input name="roomId" type="hidden" value={selectedRoom.id} />
            <textarea
              className="min-h-24 resize-y rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              maxLength={500}
              name="body"
              placeholder={`Message #${selectedRoom.slug}`}
              required
            />
            <div className="flex justify-end">
              <Button disabled={pending} type="submit" variant="primary">
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
            <p className="text-sm text-bc-muted">
              {selectedRoom ? "Sign in to join the chat." : "Admin room setup is needed before chat opens."}
            </p>
            {selectedRoom ? (
              <ButtonLink href="/auth/login" size="sm" variant="ghost">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Login
              </ButtonLink>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
