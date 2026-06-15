"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Flag, ImageIcon, Lock, LogIn, MessageSquare, Search, Send, Smile, Star, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { publicChatAction } from "@/app/chat/actions";
import { ChatEffectSelector } from "@/app/chat/chat-effect-selector";
import { ChatEffectText } from "@/app/chat/chat-effect-text";
import { roleBadgeTone, roleDisplayName, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import { hasPermission } from "@/lib/auth/rbac";
import { chatReactionOptions } from "@/lib/chat/reactions";
import {
  initialPublicChatActionState,
  type PublicChatActionState,
  type PublicChatAssetRow,
  type PublicChatMessageRow,
  type PublicChatRoomRow,
  type PublicChatUser
} from "@/app/chat/state";

type ChatRoomPanelProps = {
  assets: PublicChatAssetRow[];
  rooms: PublicChatRoomRow[];
  selectedRoom: PublicChatRoomRow | null;
  messages: PublicChatMessageRow[];
  currentUser: PublicChatUser | null;
  currentStarBalance?: number;
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

type SyncedMessages = {
  roomId: string;
  messages: PublicChatMessageRow[];
};

type ChatStreamPayload = {
  messages?: PublicChatMessageRow[];
};

type ChatRoomStreamPayload = {
  room?: PublicChatRoomRow | null;
};

const reportReasonOptions = ["spam", "harassment", "hate", "explicit", "copyright", "other"] as const;
const liveStarSendAmounts = [10, 25, 50, 100, 250] as const;

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

function slowModeLabel(seconds: number) {
  if (seconds >= 60) {
    const minutes = Math.round(seconds / 60);

    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function ChatRoomPanel({
  assets,
  rooms,
  selectedRoom,
  messages,
  currentUser,
  currentStarBalance = 0,
  roleDisplayLabels,
  compact = false,
  showRoomLinks = true
}: ChatRoomPanelProps) {
  const [state, formAction, pending] = useActionState<PublicChatActionState, FormData>(
    publicChatAction,
    initialPublicChatActionState
  );
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("rave");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(false);
  const [composerBody, setComposerBody] = useState("");
  const [selectedEffectId, setSelectedEffectId] = useState("");
  const [syncedMessages, setSyncedMessages] = useState<SyncedMessages | null>(null);
  const [syncedRoom, setSyncedRoom] = useState<PublicChatRoomRow | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const selectedRoomId = selectedRoom?.id;
  const visibleRoom = syncedRoom && syncedRoom.id === selectedRoomId ? syncedRoom : selectedRoom;
  const visibleMessages = syncedMessages && syncedMessages.roomId === selectedRoomId ? syncedMessages.messages : messages;
  const latestMessageId = visibleMessages.length ? visibleMessages[visibleMessages.length - 1]?.id : "empty";
  const currentUserCanModerate = hasPermission(currentUser, "moderation.use");
  const roomLockedForUser = Boolean(visibleRoom?.lockedAt && !currentUserCanModerate);
  const stickerAssets = assets.filter((asset) => asset.kind === "sticker");
  const emojiAssets = assets.filter((asset) => asset.kind === "emoji");

  const scrollToLatestMessage = useCallback(() => {
    const viewport = messagesViewportRef.current;

    if (!viewport) {
      return;
    }

    window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }, []);

  const loadLatestMessages = useCallback(async (roomId: string) => {
    const response = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as { messages?: PublicChatMessageRow[] };

    if (response.ok && payload.messages) {
      setSyncedMessages({
        roomId,
        messages: payload.messages
      });
    }
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }

    let active = true;
    const roomId = selectedRoomId;
    let fallbackInterval: number | null = null;
    let eventSource: EventSource | null = null;

    async function refreshMessages() {
      if (!active) {
        return;
      }

      try {
        await loadLatestMessages(roomId);
      } catch {
        // Keep showing the current messages if a polling request fails.
      }
    }

    function startPollingFallback() {
      if (fallbackInterval !== null) {
        return;
      }

      void refreshMessages();
      fallbackInterval = window.setInterval(refreshMessages, 5000);
    }

    if ("EventSource" in window) {
      eventSource = new EventSource(`/api/chat/rooms/${encodeURIComponent(roomId)}/stream`);

      eventSource.addEventListener("messages", (event) => {
        if (!active) {
          return;
        }

        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as ChatStreamPayload;

          if (payload.messages) {
            setSyncedMessages({
              roomId,
              messages: payload.messages
            });
          }
        } catch {
          // Ignore malformed stream events and keep the current chat view.
        }
      });

      eventSource.addEventListener("room", (event) => {
        if (!active) {
          return;
        }

        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as ChatRoomStreamPayload;

          if (payload.room?.id === roomId) {
            setSyncedRoom(payload.room);
          }
        } catch {
          // Ignore malformed room events and keep the current room state.
        }
      });

      eventSource.onerror = () => {
        if (!active) {
          return;
        }

        eventSource?.close();
        eventSource = null;
        startPollingFallback();
      };
    } else {
      startPollingFallback();
    }

    return () => {
      active = false;
      eventSource?.close();

      if (fallbackInterval !== null) {
        window.clearInterval(fallbackInterval);
      }
    };
  }, [loadLatestMessages, selectedRoomId]);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setComposerBody("");
    }, 0);
    const syncTimer = selectedRoomId
      ? window.setTimeout(() => {
          void loadLatestMessages(selectedRoomId);
        }, 0)
      : null;

    return () => {
      window.clearTimeout(resetTimer);

      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
      }
    };
  }, [loadLatestMessages, state.status, state.message, selectedRoomId]);

  useEffect(() => {
    scrollToLatestMessage();
  }, [latestMessageId, scrollToLatestMessage]);

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
    <section className="min-w-0 overflow-hidden rounded-md border border-bc-line bg-bc-panel">
      <div className="border-b border-bc-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone={visibleRoom ? roomTone(visibleRoom.type) : "muted"}>{visibleRoom?.type ?? "Chat"}</Badge>
            <h2 className={`${compact ? "text-xl" : "text-2xl"} mt-3 font-black`}>{visibleRoom?.name ?? "Chat rooms"}</h2>
            <p className="mt-1 text-sm text-bc-muted">
              {visibleRoom ? `${visibleMessages.length} visible messages in #${visibleRoom.slug}.` : "Create rooms from admin to start chat."}
            </p>
            {visibleRoom?.lockedAt || visibleRoom?.slowModeSeconds ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleRoom.lockedAt ? (
                  <Badge className="gap-1" tone="pink">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Locked
                  </Badge>
                ) : null}
                {visibleRoom.slowModeSeconds > 0 ? (
                  <Badge className="gap-1" tone="amber">
                    <Timer className="h-3 w-3" aria-hidden="true" />
                    {slowModeLabel(visibleRoom.slowModeSeconds)}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
          {currentUser ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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

      <div
        className={`${compact ? "max-h-[380px]" : "max-h-[560px]"} overflow-y-auto overflow-x-hidden p-4`}
        data-testid="chat-message-list"
        ref={messagesViewportRef}
      >
        <div className="space-y-3">
          {visibleMessages.map((message) => {
            const mediaSize = imageSize(message.mediaWidth, message.mediaHeight);
            const canReportMessage = Boolean(currentUser && message.authorUserId && currentUser.id !== message.authorUserId);
            const isCustomAssetMessage = (message.kind === "sticker" || message.kind === "emoji") && Boolean(message.mediaUrl);

            return (
              <article className="min-w-0 overflow-hidden rounded-md border border-bc-line bg-bc-ink p-3" key={message.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words font-semibold">{message.authorDisplayName}</span>
                    {message.authorRoles.map((role) => (
                      <Badge className="py-0.5" key={role} tone={roleBadgeTone(role)}>
                        {roleDisplayName(role, roleDisplayLabels)}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-bc-muted">{formatTime(message.createdAt)}</span>
                </div>

                {message.kind === "stars" ? (
                  <div className="mt-3 rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Star className="h-5 w-5 fill-bc-acid text-bc-acid" aria-hidden="true" />
                      <span className="text-xl font-black text-bc-acid">
                        {(message.starAmount ?? 0).toLocaleString("en-GB")} stars
                      </span>
                      <Badge tone="acid">Stream support</Badge>
                    </div>
                    {message.starNote ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">{message.starNote}</p> : null}
                  </div>
                ) : message.kind === "gif" && message.mediaUrl ? (
                  <div className="mt-3">
                    <Image
                      alt={message.mediaAlt ?? message.body}
                      className={`h-auto w-auto max-w-full rounded-md border border-bc-line object-contain ${compact ? "max-h-40" : "max-h-72"}`}
                      height={mediaSize.height}
                      onLoad={scrollToLatestMessage}
                      sizes={compact ? "320px" : "520px"}
                      src={message.mediaUrl}
                      unoptimized
                      width={mediaSize.width}
                    />
                  </div>
                ) : isCustomAssetMessage ? (
                  <div className="mt-3">
                    <Image
                      alt={message.mediaAlt ?? message.body}
                      className={`h-auto w-auto max-w-full object-contain ${
                        message.kind === "emoji" ? "max-h-20" : compact ? "max-h-36" : "max-h-56"
                      }`}
                      height={message.kind === "emoji" ? 96 : 240}
                      onLoad={scrollToLatestMessage}
                      sizes={message.kind === "emoji" ? "96px" : compact ? "220px" : "320px"}
                      src={message.mediaUrl ?? ""}
                      unoptimized
                      width={message.kind === "emoji" ? 96 : 240}
                    />
                  </div>
                ) : (
                  <ChatEffectText body={message.body} effectId={message.effectId} />
                )}

                {selectedRoom && !message.deletedAt ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-bc-line pt-3">
                    {currentUser
                      ? chatReactionOptions.map((reaction) => {
                          const summary = message.reactions.find((item) => item.key === reaction.key);
                          const count = summary?.count ?? 0;

                          return (
                            <form action={formAction} key={reaction.key}>
                              <input name="intent" type="hidden" value="reaction" />
                              <input name="roomId" type="hidden" value={selectedRoom.id} />
                              <input name="messageId" type="hidden" value={message.id} />
                              <input name="reactionKey" type="hidden" value={reaction.key} />
                              <button
                                aria-label={reaction.label}
                                className={`bc-focus-ring inline-flex min-h-8 items-center gap-1 rounded-full border px-2 text-sm transition disabled:opacity-50 ${
                                  summary?.reacted
                                    ? "border-bc-electric/60 bg-bc-electric/15 text-white"
                                    : "border-bc-line bg-bc-panel text-bc-muted hover:border-bc-electric/50 hover:text-white"
                                }`}
                                disabled={pending || roomLockedForUser}
                                title={reaction.label}
                                type="submit"
                              >
                                <span aria-hidden="true">{reaction.icon}</span>
                                {count > 0 ? <span className="text-xs font-semibold">{count}</span> : null}
                              </button>
                            </form>
                          );
                        })
                      : message.reactions.map((reaction) => {
                          const option = chatReactionOptions.find((item) => item.key === reaction.key);

                          return option ? (
                            <span
                              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-bc-line bg-bc-panel px-2 text-sm text-bc-muted"
                              key={reaction.key}
                              title={option.label}
                            >
                              <span aria-hidden="true">{option.icon}</span>
                              <span className="text-xs font-semibold">{reaction.count}</span>
                            </span>
                          ) : null;
                        })}
                  </div>
                ) : null}

                {canReportMessage && selectedRoom ? (
                  <form action={formAction} className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-bc-line pt-3">
                    <input name="intent" type="hidden" value="report" />
                    <input name="roomId" type="hidden" value={selectedRoom.id} />
                    <input name="messageId" type="hidden" value={message.id} />
                    <select
                      aria-label="Report reason"
                      className="min-h-9 rounded-md border border-bc-line bg-bc-panel px-2 py-1 text-xs text-white"
                      defaultValue="spam"
                      name="reason"
                    >
                      {reportReasonOptions.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    <Button disabled={pending} size="sm" type="submit" variant="dark">
                      <Flag className="h-4 w-4" aria-hidden="true" />
                      Report
                    </Button>
                  </form>
                ) : null}
              </article>
            );
          })}
          {!visibleMessages.length ? (
            <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-bc-line bg-bc-ink p-6 text-center">
              <div>
                <MessageSquare className="mx-auto h-7 w-7 text-bc-electric" aria-hidden="true" />
                <p className="mt-3 text-sm text-bc-muted">
                  {visibleRoom ? "No messages yet. Start the room off." : "No chat rooms are configured yet."}
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
            {roomLockedForUser ? (
              <div className="rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
                This chat room is locked by moderation.
              </div>
            ) : null}
            {visibleRoom?.type === "live" ? (
              <form action={formAction} className="grid gap-3 rounded-md border border-bc-acid/25 bg-bc-acid/10 p-3">
                <input name="intent" type="hidden" value="stars" />
                <input name="roomId" type="hidden" value={selectedRoom.id} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Star className="h-5 w-5 fill-bc-acid text-bc-acid" aria-hidden="true" />
                    <span className="font-black">Send stars</span>
                    <Badge tone="acid">{currentStarBalance.toLocaleString("en-GB")} available</Badge>
                  </div>
                  <ButtonLink href="/account/rewards" size="sm" variant="dark">
                    Buy stars
                  </ButtonLink>
                </div>
                <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                  <select
                    aria-label="Star amount"
                    className="min-h-10 min-w-0 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                    name="amount"
                  >
                    {liveStarSendAmounts.map((amount) => (
                      <option key={amount} value={amount}>
                        {amount} stars
                      </option>
                    ))}
                  </select>
                  <input
                    className="min-h-10 min-w-0 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                    maxLength={160}
                    name="note"
                    placeholder="Optional stream alert message"
                  />
                  <Button
                    className="min-w-0 px-3"
                    disabled={pending || roomLockedForUser || currentStarBalance < liveStarSendAmounts[0]}
                    type="submit"
                    variant="primary"
                  >
                    <Star className="h-4 w-4" aria-hidden="true" />
                    Send
                  </Button>
                </div>
              </form>
            ) : null}

            <form action={formAction} className="grid gap-3">
              <input name="intent" type="hidden" value="text" />
              <input name="roomId" type="hidden" value={selectedRoom.id} />
              <textarea
                className="min-h-24 min-w-0 resize-y rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                maxLength={500}
                name="body"
                onChange={(event) => setComposerBody(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={`Message #${visibleRoom?.slug ?? selectedRoom.slug}`}
                ref={textareaRef}
                disabled={roomLockedForUser}
                required
                value={composerBody}
              />
              {composerBody.trim() && selectedEffectId ? (
                <div className="rounded-md border border-bc-line bg-bc-ink px-3 py-2">
                  <div className="text-xs font-semibold uppercase text-bc-muted">Preview</div>
                  <ChatEffectText body={composerBody} className="mt-2" effectId={selectedEffectId} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-bc-muted">Press Enter to send message. Shift+Enter for line break.</p>
                <div className="flex w-full min-w-0 flex-wrap justify-start gap-2 sm:w-auto sm:justify-end">
                  <ChatEffectSelector
                    disabled={roomLockedForUser}
                    onChange={setSelectedEffectId}
                    selectedEffectId={selectedEffectId}
                    userRoles={currentUser.roles}
                  />
                  <Button
                    disabled={roomLockedForUser}
                    onClick={() => {
                      setGifPanelOpen((open) => !open);
                      setAssetPanelOpen(false);
                    }}
                    type="button"
                    variant={gifPanelOpen ? "dark" : "ghost"}
                  >
                    <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    GIF
                  </Button>
                  <Button
                    disabled={roomLockedForUser}
                    onClick={() => {
                      setAssetPanelOpen((open) => !open);
                      setGifPanelOpen(false);
                    }}
                    type="button"
                    variant={assetPanelOpen ? "dark" : "ghost"}
                  >
                    <Smile className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Stickers
                  </Button>
                  <Button disabled={pending || roomLockedForUser} type="submit" variant="primary">
                    <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Send
                  </Button>
                </div>
              </div>
            </form>

            {assetPanelOpen ? (
              <section className="rounded-md border border-bc-line bg-bc-ink p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="pink">Custom chat assets</Badge>
                  <span className="text-xs font-semibold text-bc-muted">{assets.length} available</span>
                </div>

                {assets.length ? (
                  <div className="mt-3 grid gap-4">
                    {[
                      { label: "Stickers", items: stickerAssets },
                      { label: "Animated emoji", items: emojiAssets }
                    ].map((group) =>
                      group.items.length ? (
                        <div key={group.label}>
                          <p className="text-xs font-semibold uppercase text-bc-muted">{group.label}</p>
                          <div
                            className={`mt-2 grid gap-2 ${
                              compact ? "grid-cols-[repeat(auto-fit,minmax(88px,1fr))]" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
                            }`}
                          >
                            {group.items.map((asset) => (
                              <form action={formAction} className="min-w-0" key={asset.id}>
                                <input name="intent" type="hidden" value="asset" />
                                <input name="roomId" type="hidden" value={selectedRoom.id} />
                                <input name="assetId" type="hidden" value={asset.id} />
                                <button
                                  className="bc-focus-ring group grid w-full gap-2 rounded-md border border-bc-line bg-bc-panel p-2 text-left transition hover:border-bc-electric/60"
                                  disabled={pending || roomLockedForUser}
                                  title={`${asset.name} ${asset.shortcode}`}
                                  type="submit"
                                >
                                  <span className="relative aspect-square w-full overflow-hidden rounded-md bg-bc-void">
                                    <Image
                                      alt={asset.name}
                                      className="h-full w-full object-contain transition group-hover:scale-105"
                                      height={160}
                                      sizes={compact ? "96px" : "140px"}
                                      src={asset.imageUrl}
                                      unoptimized
                                      width={160}
                                    />
                                  </span>
                                  <span className="truncate text-xs font-semibold text-white">{asset.name}</span>
                                  <span className="flex flex-wrap gap-1">
                                    <Badge className="py-0.5" tone={asset.kind === "emoji" ? "cyan" : "pink"}>
                                      {asset.kind}
                                    </Badge>
                                    {asset.isAnimated ? (
                                      <Badge className="py-0.5" tone="acid">
                                        Animated
                                      </Badge>
                                    ) : null}
                                  </span>
                                </button>
                              </form>
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border border-dashed border-bc-line bg-bc-panel p-3 text-sm text-bc-muted">
                    No custom stickers or emoji are available yet.
                  </p>
                )}
              </section>
            ) : null}

            {gifPanelOpen ? (
              <section className="rounded-md border border-bc-line bg-bc-ink p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="cyan">GIFs</Badge>
                  <span className="text-xs font-semibold text-bc-muted">GIFs by Tenor</span>
                </div>
                <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={searchGifs}>
                  <input
                    className="min-h-10 min-w-0 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
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
                  <div
                    className={`mt-3 grid gap-2 ${
                      compact ? "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                    }`}
                  >
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
                            disabled={pending || roomLockedForUser}
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
