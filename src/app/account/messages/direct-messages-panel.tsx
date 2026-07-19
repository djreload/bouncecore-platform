"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Download, Flag, Inbox, LoaderCircle, MessageCircle, Paperclip, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { directMessageMaxLength } from "@/lib/messages/direct-message-core";
import type { DirectMessagingData, DirectMessageUserSummary } from "@/lib/messages/direct-message-service";
import { cn } from "@/lib/utils";

type DirectMessagesPanelProps = {
  currentUserId: string;
  initialData: DirectMessagingData;
  initialError?: string | null;
};

type Feedback = {
  message: string;
  status: "error" | "success";
} | null;

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Europe/London"
  }).format(new Date(value));
}

function Avatar({ user, size = "md" }: { user: DirectMessageUserSummary; size?: "md" | "sm" }) {
  const classes = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  if (user.avatarUrl) {
    return (
      <Image
        alt=""
        className={cn(classes, "shrink-0 rounded-md border border-bc-line object-cover")}
        height={size === "sm" ? 32 : 40}
        src={user.avatarUrl}
        unoptimized
        width={size === "sm" ? 32 : 40}
      />
    );
  }

  return (
    <span className={cn(classes, "grid shrink-0 place-items-center rounded-md border border-bc-electric/35 bg-bc-electric/10 font-black text-bc-electric")}>
      {user.displayName.slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

async function responseJson(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Private message request failed.");
  }

  return payload;
}

export function DirectMessagesPanel({ currentUserId, initialData, initialError = null }: DirectMessagesPanelProps) {
  const [data, setData] = useState(initialData);
  const [selectedConversationId, setSelectedConversationId] = useState(initialData.selectedConversationId);
  const [recipientId, setRecipientId] = useState(initialData.recipients[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [filename, setFilename] = useState("");
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialError ? { message: initialError, status: "error" } : null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportNotes, setReportNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const sendFormRef = useRef<HTMLFormElement>(null);
  const selectedConversation = useMemo(
    () => data.conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [data.conversations, selectedConversationId]
  );
  const totalUnread = data.conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const messagingBlocked = data.selectedBlockState.blockedByCurrentUser || data.selectedBlockState.blockedCurrentUser;

  const refresh = useCallback(async (conversationId: string | null = selectedConversationId, quiet = false) => {
    if (!quiet) {
      setRefreshing(true);
    }

    try {
      const query = conversationId ? `?conversation=${encodeURIComponent(conversationId)}&revision=${Date.now()}` : `?revision=${Date.now()}`;
      const response = await fetch(`/api/direct-messages${query}`, {
        cache: "no-store",
        credentials: "same-origin"
      });
      const payload = (await responseJson(response)) as unknown as DirectMessagingData;
      setData(payload);
      setSelectedConversationId(payload.selectedConversationId);
    } catch (error) {
      if (!quiet) {
        setFeedback({ message: error instanceof Error ? error.message : "Messages could not be refreshed.", status: "error" });
      }
    } finally {
      if (!quiet) {
        setRefreshing(false);
      }
    }
  }, [selectedConversationId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(selectedConversationId, true);
      }
    }, 4_000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh(selectedConversationId, true);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh, selectedConversationId]);

  useEffect(() => {
    const viewport = messageViewportRef.current;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [data.messages.length, selectedConversationId]);

  useEffect(() => {
    if (!feedback || feedback.status === "error") {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 1_800);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function startConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!recipientId || pending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.set("intent", "start");
      formData.set("targetUserId", recipientId);
      const response = await fetch("/api/direct-messages", { body: formData, method: "POST" });
      const payload = (await responseJson(response)) as { conversationId: string };
      selectConversation(payload.conversationId);
      await refresh(payload.conversationId);
      setFeedback({ message: "Private conversation ready.", status: "success" });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Conversation could not be opened.", status: "error" });
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversationId || pending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("intent", "send");
      formData.set("conversationId", selectedConversationId);
      const response = await fetch("/api/direct-messages", { body: formData, method: "POST" });
      await responseJson(response);
      setBody("");
      setFilename("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await refresh(selectedConversationId, true);
      setFeedback({ message: "Private message sent.", status: "success" });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Private message could not be sent.", status: "error" });
    } finally {
      setPending(false);
    }
  }

  async function conversationAction(intent: "block" | "report" | "unblock", values?: { notes?: string; reason?: string }) {
    if (!selectedConversationId || pending) {
      return;
    }

    if (
      intent === "block" &&
      !window.confirm(`Block ${selectedConversation?.otherUser.displayName ?? "this user"}? Neither of you will be able to send private messages until you unblock them.`)
    ) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.set("intent", intent);
      formData.set("conversationId", selectedConversationId);

      if (values?.reason) {
        formData.set("reason", values.reason);
      }

      if (values?.notes) {
        formData.set("notes", values.notes);
      }

      const response = await fetch("/api/direct-messages", { body: formData, method: "POST" });
      await responseJson(response);
      await refresh(selectedConversationId, true);

      if (intent === "report") {
        setReportOpen(false);
        setReportNotes("");
      }

      setFeedback({
        message: intent === "block" ? "User blocked." : intent === "unblock" ? "User unblocked." : "Report sent to moderation.",
        status: "success"
      });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Private message action failed.", status: "error" });
    } finally {
      setPending(false);
    }
  }

  function selectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    setReportOpen(false);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("conversation", conversationId);
      window.history.replaceState({}, "", url);
    }

    void refresh(conversationId, true);
  }

  return (
    <section className="overflow-hidden rounded-md border border-bc-line bg-bc-panel">
      <div className="grid min-h-[66dvh] lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-bc-line bg-bc-ink lg:border-b-0 lg:border-r">
          <div className="border-b border-bc-line p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">Messages</p>
                <p className="text-xs text-bc-muted">{totalUnread ? `${totalUnread} unread` : "Up to date"}</p>
              </div>
              <Button aria-label="Refresh private messages" disabled={refreshing} onClick={() => void refresh()} size="sm" type="button" variant="ghost">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden="true" />
              </Button>
            </div>
            <form className="mt-3 grid gap-2" onSubmit={startConversation}>
              <label className="text-xs font-semibold text-bc-muted" htmlFor="direct-message-recipient">
                Start a conversation
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <select
                  className="min-h-9 min-w-0 rounded-md border border-bc-line bg-bc-panel px-2 text-xs text-white"
                  disabled={!data.recipients.length || pending}
                  id="direct-message-recipient"
                  onChange={(event) => setRecipientId(event.target.value)}
                  value={recipientId}
                >
                  {data.recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.displayName}
                    </option>
                  ))}
                </select>
                <Button aria-label="Start private conversation" disabled={!recipientId || pending} size="sm" type="submit" variant="primary">
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
              <p className="text-[11px] leading-4 text-bc-muted">Choose an active verified account. Messages are visible only to both participants.</p>
            </form>
          </div>
          <div className="flex max-h-56 gap-2 overflow-x-auto p-2 lg:max-h-[calc(66dvh-9.75rem)] lg:grid lg:overflow-y-auto">
            {data.conversations.map((conversation) => (
              <button
                className={cn(
                  "bc-focus-ring min-w-56 rounded-md border p-2 text-left transition lg:min-w-0",
                  conversation.id === selectedConversationId
                    ? "border-bc-electric/60 bg-bc-electric/10"
                    : "border-bc-line bg-bc-panel hover:border-bc-electric/35"
                )}
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <Avatar size="sm" user={conversation.otherUser} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white">{conversation.otherUser.displayName}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-bc-muted">{conversation.lastMessagePreview}</span>
                  </span>
                  {conversation.unreadCount ? <Badge tone="pink">{conversation.unreadCount}</Badge> : null}
                </div>
              </button>
            ))}
            {!data.conversations.length ? (
              <div className="min-w-64 rounded-md border border-dashed border-bc-line p-3 text-xs text-bc-muted lg:min-w-0">
                Choose someone above to begin your first private conversation.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-[34rem] min-w-0 flex-col">
          {selectedConversation ? (
            <>
              <header className="border-b border-bc-line bg-bc-ink/70 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={selectedConversation.otherUser} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-black">{selectedConversation.otherUser.displayName}</h3>
                    <p className="text-xs text-bc-muted">
                      {data.selectedBlockState.blockedByCurrentUser
                        ? "Blocked by you"
                        : data.selectedBlockState.blockedCurrentUser
                          ? "This account has blocked private messages"
                          : "Private one-to-one conversation"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      aria-label={data.selectedBlockState.blockedByCurrentUser ? `Unblock ${selectedConversation.otherUser.displayName}` : `Block ${selectedConversation.otherUser.displayName}`}
                      disabled={pending}
                      onClick={() => void conversationAction(data.selectedBlockState.blockedByCurrentUser ? "unblock" : "block")}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{data.selectedBlockState.blockedByCurrentUser ? "Unblock" : "Block"}</span>
                    </Button>
                    <Button
                      aria-expanded={reportOpen}
                      aria-label={`Report ${selectedConversation.otherUser.displayName}`}
                      disabled={pending}
                      onClick={() => setReportOpen((current) => !current)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {reportOpen ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Flag className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span className="hidden sm:inline">Report</span>
                    </Button>
                  </div>
                </div>
                {reportOpen ? (
                  <form
                    className="mt-3 grid gap-2 rounded-md border border-bc-pink/30 bg-bc-pink/5 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void conversationAction("report", { notes: reportNotes, reason: reportReason });
                    }}
                  >
                    <label className="grid gap-1 text-[11px] font-semibold text-bc-muted">
                      Report reason
                      <select
                        className="min-h-9 rounded-md border border-bc-line bg-bc-panel px-2 text-xs text-white"
                        disabled={pending}
                        onChange={(event) => setReportReason(event.target.value)}
                        value={reportReason}
                      >
                        <option value="spam">Spam</option>
                        <option value="harassment">Harassment</option>
                        <option value="hate">Hate</option>
                        <option value="explicit">Explicit content</option>
                        <option value="copyright">Copyright</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-[11px] font-semibold text-bc-muted">
                      Optional details
                      <input
                        className="min-h-9 min-w-0 rounded-md border border-bc-line bg-bc-panel px-2 text-xs text-white"
                        disabled={pending}
                        maxLength={500}
                        onChange={(event) => setReportNotes(event.target.value)}
                        placeholder="Tell moderation what happened"
                        value={reportNotes}
                      />
                    </label>
                    <Button className="self-end" disabled={pending} size="sm" type="submit" variant="pink">
                      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                      Send report
                    </Button>
                  </form>
                ) : null}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-3" ref={messageViewportRef}>
                <div className="grid gap-3">
                  {data.messages.map((message) => {
                    const own = message.sender.id === currentUserId;
                    const attachmentCaption = message.mediaAlt && message.body === message.mediaAlt ? "" : message.body;

                    return (
                      <article
                        className={cn("flex max-w-[88%] items-end gap-2", own ? "ml-auto flex-row-reverse" : "mr-auto")}
                        id={`direct-message-${message.id}`}
                        key={message.id}
                      >
                        <Avatar size="sm" user={message.sender} />
                        <div className={cn("min-w-0 rounded-md border p-2", own ? "border-bc-electric/35 bg-bc-electric/10" : "border-bc-line bg-bc-ink")}>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-black text-white">{message.sender.displayName}</span>
                            <span className="text-bc-muted">{formatMessageTime(message.createdAt)}</span>
                          </div>
                          {message.kind === "attachment-image" && message.mediaPreviewUrl ? (
                            <Image
                              alt={message.mediaAlt ?? "Private image attachment"}
                              className="mt-2 max-h-72 w-auto max-w-full rounded-md border border-bc-line object-contain"
                              height={360}
                              src={message.mediaPreviewUrl}
                              unoptimized
                              width={480}
                            />
                          ) : null}
                          {message.kind === "attachment-file" && message.mediaUrl ? (
                            <a
                              className="bc-focus-ring mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-bc-line px-3 text-xs font-semibold text-bc-electric"
                              download
                              href={message.mediaUrl}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              {message.mediaAlt ?? "Download ZIP"}
                            </a>
                          ) : null}
                          {attachmentCaption ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white">{attachmentCaption}</p> : null}
                        </div>
                      </article>
                    );
                  })}
                  {!data.messages.length ? (
                    <div className="m-auto max-w-sm py-12 text-center">
                      <MessageCircle className="mx-auto h-8 w-8 text-bc-electric" aria-hidden="true" />
                      <p className="mt-3 text-sm font-black">Conversation ready</p>
                      <p className="mt-1 text-xs text-bc-muted">Send a message, an image, or a ZIP file.</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <footer className="border-t border-bc-line bg-bc-ink p-3">
                {feedback ? (
                  <div
                    aria-live="polite"
                    className={cn(
                      "mb-2 rounded-md border px-3 py-2 text-xs",
                      feedback.status === "error" ? "border-bc-pink/35 bg-bc-pink/10 text-bc-pink" : "border-bc-acid/35 bg-bc-acid/10 text-bc-acid"
                    )}
                  >
                    {feedback.message}
                  </div>
                ) : null}
                {messagingBlocked ? (
                  <div className="rounded-md border border-bc-amber/35 bg-bc-amber/10 px-3 py-2 text-xs text-bc-amber">
                    {data.selectedBlockState.blockedByCurrentUser
                      ? `You blocked ${selectedConversation.otherUser.displayName}. Unblock them to resume this conversation.`
                      : `${selectedConversation.otherUser.displayName} is not accepting private messages from you.`}
                  </div>
                ) : (
                <form className="grid gap-2" onSubmit={sendMessage} ref={sendFormRef}>
                  <textarea
                    className="min-h-16 w-full resize-none rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white placeholder:text-bc-muted"
                    maxLength={directMessageMaxLength}
                    name="body"
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendFormRef.current?.requestSubmit();
                      }
                    }}
                    placeholder={`Message ${selectedConversation.otherUser.displayName}`}
                    value={body}
                  />
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Button
                        aria-label="Attach private image or ZIP file"
                        disabled={pending}
                        onClick={() => fileInputRef.current?.click()}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <span className="truncate text-[11px] text-bc-muted">{filename || `${body.length}/${directMessageMaxLength}`}</span>
                    </div>
                    <Button disabled={pending || (!body.trim() && !filename)} size="sm" type="submit" variant="primary">
                      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                      Send
                    </Button>
                  </div>
                  <input
                    accept=".jpg,.jpeg,.jfif,.png,.gif,.webp,.avif,.bmp,.zip,image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,application/zip"
                    className="sr-only"
                    name="file"
                    onChange={(event) => setFilename(event.target.files?.[0]?.name ?? "")}
                    ref={fileInputRef}
                    type="file"
                  />
                  <p className="text-[11px] text-bc-muted">Enter sends. Shift+Enter adds a line. Images display inline; ZIP files show a private download button.</p>
                </form>
                )}
              </footer>
            </>
          ) : (
            <div className="m-auto max-w-sm p-6 text-center">
              <Inbox className="mx-auto h-10 w-10 text-bc-electric" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">Private messages</h3>
              <p className="mt-2 text-sm text-bc-muted">Choose an active account to start a secure one-to-one conversation.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
