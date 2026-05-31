"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ImageIcon, LogIn, MessageSquare, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { publicChatAction } from "@/app/chat/actions";
import { roleBadgeTone, roleDisplayName, type RoleDisplayNameMap } from "@/lib/auth/role-display";
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
  roleDisplayLabels: RoleDisplayNameMap;
  compact?: boolean;
  showRoomLinks?: boolean;
};

type GifResult = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
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

function imageSize(width: number | null, height: number | null) {
  return {
    width: width ?? 360,
    height: height ?? 260
  };
}

export function ChatRoomPanel({
  rooms,
  selectedRoom,
  messages,
  currentUser,
  roleDisplayLabels,
  compact = false,
  showRoomLinks = true
}: ChatRoomPanelProps) {
  const [state, formAction, pending] = useActionState<PublicChatActionState, FormData>(
    publicChatAction,
    initialPublicChatActionState
  );
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("rave");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.status === "success" && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [state.status, state.message]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function searchGifs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = gifQuery.trim();

    if (!query) {
      setGifError("Enter a GIF search term.");
      return;
    }

    setGifLoading(true);
    setGifError(null);

    try {
      const response = await fetch(`/api/chat/gifs?q=${encodeURIComponent(query)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { gifs?: GifResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "GIF search failed.");
      }

      setGifResults(payload.gifs ?? []);
      setGifError(payload.gifs?.length ? null : "No GIFs found.");
    } catch (error) {
      setGifResults([]);
      setGifError(error instanceof Error ? error.message : "GIF search failed.");
    } finally {
      setGifLoading(false);
    }
  }

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
          {currentUser ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone="acid">{currentUser.displayName}</Badge>
              {currentUser.roles.map((role) => (
                <Badge key={role} tone={roleBadgeTone(role)}>
                  {roleDisplayName(role, roleDisplayLabels)}
                </Badge>
              ))}
            </div>
          ) : null}
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
          {messages.map((message) => {
            const mediaSize = imageSize(message.mediaWidth, message.mediaHeight);

            return (
              <article className="rounded-md border border-bc-line bg-bc-ink p-3" key={message.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{message.authorDisplayName}</span>
                    {message.authorRoles.map((role) => (
                      <Badge className="py-0.5" key={role} tone={roleBadgeTone(role)}>
                        {roleDisplayName(role, roleDisplayLabels)}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-bc-muted">{formatTime(message.createdAt)}</span>
                </div>

                {message.kind === "gif" && message.mediaUrl ? (
                  <div className="mt-3">
                    <Image
                      alt={message.mediaAlt ?? message.body}
                      className={`h-auto w-auto max-w-full rounded-md border border-bc-line object-contain ${compact ? "max-h-40" : "max-h-72"}`}
                      height={mediaSize.height}
                      sizes={compact ? "320px" : "520px"}
                      src={message.mediaUrl}
                      unoptimized
                      width={mediaSize.width}
                    />
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">{message.body}</p>
                )}
              </article>
            );
          })}
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
          <div className="grid gap-3">
            <form action={formAction} className="grid gap-3">
              <input name="intent" type="hidden" value="text" />
              <input name="roomId" type="hidden" value={selectedRoom.id} />
              <textarea
                className="min-h-24 resize-y rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                maxLength={500}
                name="body"
                onKeyDown={handleComposerKeyDown}
                placeholder={`Message #${selectedRoom.slug}`}
                ref={textareaRef}
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-bc-muted">Press Enter to send message. Shift+Enter for line break.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    onClick={() => setGifPanelOpen((open) => !open)}
                    type="button"
                    variant={gifPanelOpen ? "dark" : "ghost"}
                  >
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    GIF
                  </Button>
                  <Button disabled={pending} type="submit" variant="primary">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send
                  </Button>
                </div>
              </div>
            </form>

            {gifPanelOpen ? (
              <section className="rounded-md border border-bc-line bg-bc-ink p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="cyan">GIFs</Badge>
                  <span className="text-xs font-semibold text-bc-muted">GIFs by Tenor</span>
                </div>
                <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={searchGifs}>
                  <input
                    className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    maxLength={80}
                    onChange={(event) => setGifQuery(event.target.value)}
                    placeholder="Search GIFs"
                    type="search"
                    value={gifQuery}
                  />
                  <Button disabled={gifLoading} type="submit" variant="ghost">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Search
                  </Button>
                </form>

                {gifError ? <p className="mt-3 text-sm text-bc-muted">{gifError}</p> : null}

                {gifResults.length ? (
                  <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
                    {gifResults.map((gif) => {
                      const resultSize = imageSize(gif.width, gif.height);

                      return (
                        <form action={formAction} key={gif.id}>
                          <input name="intent" type="hidden" value="gif" />
                          <input name="roomId" type="hidden" value={selectedRoom.id} />
                          <input name="gifId" type="hidden" value={gif.id} />
                          <input name="gifUrl" type="hidden" value={gif.url} />
                          <input name="gifPreviewUrl" type="hidden" value={gif.previewUrl} />
                          <input name="gifAlt" type="hidden" value={gif.title} />
                          <input name="gifWidth" type="hidden" value={gif.width ?? ""} />
                          <input name="gifHeight" type="hidden" value={gif.height ?? ""} />
                          <input name="gifQuery" type="hidden" value={gifQuery.trim()} />
                          <button
                            className="bc-focus-ring group relative aspect-square w-full overflow-hidden rounded-md border border-bc-line bg-bc-panel"
                            disabled={pending}
                            title={gif.title}
                            type="submit"
                          >
                            <Image
                              alt={gif.title}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                              height={resultSize.height}
                              sizes={compact ? "160px" : "220px"}
                              src={gif.previewUrl}
                              unoptimized
                              width={resultSize.width}
                            />
                          </button>
                        </form>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
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
