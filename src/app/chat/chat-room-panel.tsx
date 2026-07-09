"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type UIEvent
} from "react";
import {
  AtSign,
  Ban,
  ChevronLeft,
  ChevronRight,
  Flag,
  ImageIcon,
  Lock,
  LogIn,
  MessageSquare,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Star,
  Target,
  Timer,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { publicChatAction } from "@/app/chat/actions";
import { ChatEffectSelector } from "@/app/chat/chat-effect-selector";
import { ChatEffectText } from "@/app/chat/chat-effect-text";
import { roleBadgeTone, roleDisplayName, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import { hasPermission, hasRole } from "@/lib/auth/rbac";
import { chatReactionOptions } from "@/lib/chat/reactions";
import { canEditChatMessage } from "@/lib/chat/chat-message-edit-core";
import { getActiveMentionQuery, mentionTokenFromDisplayName, replaceActiveMention } from "@/lib/chat/mentions";
import {
  defaultSheepThrowSettings,
  formatSheepThrowCooldownLabel,
  getAvailableSheepThrowSprites,
  type SheepThrowSprite,
  type SheepThrowSettings
} from "@/lib/chat/sheep-throw-settings";
import { cn } from "@/lib/utils";
import {
  initialPublicChatActionState,
  type PublicChatActionState,
  type PublicChatAssetRow,
  type PublicChatMessageRow,
  type PublicChatPresenceUserRow,
  type PublicChatRoomRow,
  type PublicChatUser
} from "@/app/chat/state";

type ChatRoomPanelProps = {
  assets: PublicChatAssetRow[];
  rooms: PublicChatRoomRow[];
  selectedRoom: PublicChatRoomRow | null;
  messages: PublicChatMessageRow[];
  presenceUsers?: PublicChatPresenceUserRow[];
  currentUser: PublicChatUser | null;
  currentStarBalance?: number;
  sheepFreeThrowAvailable?: boolean;
  sheepRemainingCooldownSeconds?: number;
  sheepSettings?: SheepThrowSettings;
  roleDisplayLabels: RoleDisplayNameMap;
  className?: string;
  compact?: boolean;
  hideHeader?: boolean;
  mobileLiveMode?: boolean;
  messagesClassName?: string;
  showPresenceRail?: boolean;
  showRoomLinks?: boolean;
};

type GifResult = {
  id: string;
  provider: "giphy" | "klipy";
  title: string;
  gifUrl: string;
  previewUrl: string;
  width?: number | null;
  height?: number | null;
  sourceUrl?: string;
  rating?: string;
};

type SyncedMessages = {
  roomId: string;
  messages: PublicChatMessageRow[];
};

type ChatStreamPayload = {
  messages?: PublicChatMessageRow[];
};

type ChatPresenceStreamPayload = {
  presenceUsers?: PublicChatPresenceUserRow[];
};

type ChatRoomStreamPayload = {
  room?: PublicChatRoomRow | null;
};

type ChatReplyTarget = {
  id: string;
  body: string;
  kind: string;
  mediaAlt: string | null;
  deletedAt: string | null;
  authorDisplayName: string;
  starAmount?: number | null;
  starNote?: string | null;
};

type MentionSuggestion = {
  displayName: string;
  token: string;
  userId: string | null;
};

type SyncedPresence = {
  roomId: string;
  users: PublicChatPresenceUserRow[];
};

type ChatFormAction = NonNullable<ComponentProps<"form">["action"]>;

const reportReasonOptions = ["spam", "harassment", "hate", "explicit", "copyright", "other"] as const;
const inlineBanDurationOptions = [
  { label: "1 hour", value: "1h" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "Permanent", value: "permanent" }
] as const;
const liveStarSendAmounts = [10, 25, 50, 100, 250] as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(
    new Date(value)
  );
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

function imageSize(width: number | null | undefined, height: number | null | undefined) {
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

function visibleBadgeRoles<T extends string>(roles: T[]) {
  return roles.filter((role) => role !== "viewer");
}

function authorInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function chatMessagePreviewText(message: ChatReplyTarget) {
  if (message.deletedAt) {
    return "Message removed by moderation.";
  }

  if (message.kind === "gif") {
    return message.mediaAlt ? `GIF: ${message.mediaAlt}` : "GIF";
  }

  if (message.kind === "sticker" || message.kind === "emoji") {
    return message.mediaAlt ?? message.body;
  }

  if (message.kind === "stars") {
    return `${(message.starAmount ?? 0).toLocaleString("en-GB")} stars${message.starNote ? `: ${message.starNote}` : ""}`;
  }

  return message.body.replace(/\s+/g, " ").trim();
}

function presenceStatusTone(status: PublicChatPresenceUserRow["status"]) {
  return status === "online" ? "bg-bc-acid shadow-[0_0_10px_rgba(163,255,18,0.72)]" : "bg-bc-amber shadow-[0_0_10px_rgba(255,176,32,0.55)]";
}

function presenceStatusLabel(status: PublicChatPresenceUserRow["status"]) {
  return status === "online" ? "Online" : "Away";
}

function formatPresenceLastActive(value: string) {
  return formatTime(value);
}

function ChatPresenceRail({
  availableThrowSprites,
  currentUserCanThrowSheep,
  currentUserId,
  defaultThrowSprite,
  formAction,
  open,
  pending,
  roleDisplayLabels,
  roomId,
  roomLockedForUser,
  sheepThrowDisabledReason,
  sheepThrowStatusLabel,
  users,
  onToggle
}: {
  availableThrowSprites: SheepThrowSprite[];
  currentUserCanThrowSheep: boolean;
  currentUserId: string | null;
  defaultThrowSprite: SheepThrowSprite | undefined;
  formAction: ChatFormAction;
  open: boolean;
  pending: boolean;
  roleDisplayLabels: RoleDisplayNameMap;
  roomId: string | null;
  roomLockedForUser: boolean;
  sheepThrowDisabledReason: string | null;
  sheepThrowStatusLabel: string;
  users: PublicChatPresenceUserRow[];
  onToggle: () => void;
}) {
  const onlineCount = users.filter((user) => user.status === "online").length;

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={open ? "Hide online users" : "Show online users"}
        className="bc-focus-ring absolute -left-9 top-3 z-30 hidden h-8 w-8 place-items-center rounded-l-md border border-r-0 border-bc-line bg-bc-panel text-white shadow-lg shadow-black/25 transition hover:border-bc-electric/60 hover:text-bc-electric lg:grid"
        onClick={onToggle}
        title={open ? "Hide online users" : "Show online users"}
        type="button"
      >
        {open ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
      </button>
      <aside
        aria-label="Online chat users"
        className={cn(
          "absolute right-full top-0 z-20 hidden h-full w-56 min-w-56 flex-col overflow-hidden rounded-l-md border border-r-0 border-bc-line bg-bc-panel shadow-2xl shadow-black/35 transition duration-300 ease-out lg:flex",
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
        )}
      >
        <div className="shrink-0 border-b border-bc-line p-3">
          <div className="flex min-w-0 items-center gap-2">
            <UsersRound className="h-4 w-4 shrink-0 text-bc-electric" aria-hidden="true" />
            <h3 className="truncate text-sm font-black">Online users</h3>
          </div>
          <p className="mt-2 text-xs text-bc-muted">
            {onlineCount} online / {Math.max(0, users.length - onlineCount)} away
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {users.length ? (
            <div className="grid gap-2">
              {users.map((user) => {
                const canShowThrowAction = Boolean(currentUserCanThrowSheep && currentUserId && roomId && user.id !== currentUserId);
                const throwDisabled =
                  pending ||
                  roomLockedForUser ||
                  user.status !== "online" ||
                  Boolean(sheepThrowDisabledReason);

                return (
                  <article className="rounded-md border border-bc-line bg-bc-ink p-2" key={user.id}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-bc-line bg-bc-panel text-xs font-black text-bc-electric">
                        {user.avatarUrl ? (
                          <Image alt="" className="h-full w-full object-cover" height={32} src={user.avatarUrl} unoptimized width={32} />
                        ) : (
                          authorInitial(user.displayName)
                        )}
                        <span
                          aria-label={presenceStatusLabel(user.status)}
                          className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bc-ink", presenceStatusTone(user.status))}
                          title={presenceStatusLabel(user.status)}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{user.displayName}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
                          <span className="text-bc-muted">
                            {presenceStatusLabel(user.status)} / {formatPresenceLastActive(user.lastActiveAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-black text-red-400" title="Throw hits this livestream">
                            <Target className="h-3 w-3" aria-hidden="true" />
                            {user.throwHitCount.toLocaleString("en-GB")}
                          </span>
                        </div>
                      </div>
                    </div>
                    {visibleBadgeRoles(user.roles).length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {visibleBadgeRoles(user.roles).slice(0, 2).map((role) => (
                          <Badge className="py-0 text-[10px]" key={role} tone={roleBadgeTone(role)}>
                            {roleDisplayName(role, roleDisplayLabels)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {canShowThrowAction ? (
                      <form
                        action={formAction}
                        className={cn("mt-2 grid gap-1", availableThrowSprites.length > 1 && "grid-cols-[minmax(0,1fr)_auto]")}
                      >
                        <input name="intent" type="hidden" value="sheep" />
                        <input name="roomId" type="hidden" value={roomId ?? ""} />
                        <input name="targetUserId" type="hidden" value={user.id} />
                        {availableThrowSprites.length > 1 ? (
                          <select
                            aria-label="Throw type"
                            className="min-h-7 min-w-0 rounded-md border border-bc-line bg-bc-panel px-2 text-[11px] font-black text-white"
                            defaultValue={defaultThrowSprite?.id}
                            disabled={throwDisabled}
                            name="throwSpriteId"
                            title="Choose what to throw"
                          >
                            {availableThrowSprites.map((sprite) => (
                              <option key={sprite.id} value={sprite.id}>
                                {sprite.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input name="throwSpriteId" type="hidden" value={defaultThrowSprite?.id ?? "sheep"} />
                        )}
                        <Button
                          className="min-h-7 px-2 text-[11px]"
                          disabled={throwDisabled}
                          size="sm"
                          title={
                            user.status !== "online"
                              ? "User must be online and active."
                              : sheepThrowDisabledReason ?? `Throw for ${sheepThrowStatusLabel}`
                          }
                          type="submit"
                          variant="ghost"
                        >
                          <Target className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                          Throw
                        </Button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid h-full min-h-40 place-items-center rounded-md border border-dashed border-bc-line bg-bc-ink p-4 text-center">
              <div>
                <UsersRound className="mx-auto h-6 w-6 text-bc-muted" aria-hidden="true" />
                <p className="mt-3 text-xs text-bc-muted">No recent chat activity yet.</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function ChatRoomPanel({
  assets,
  rooms,
  selectedRoom,
  messages,
  presenceUsers = [],
  currentUser,
  currentStarBalance = 0,
  sheepFreeThrowAvailable = false,
  sheepRemainingCooldownSeconds = 0,
  sheepSettings = defaultSheepThrowSettings,
  roleDisplayLabels,
  className,
  compact = false,
  hideHeader = false,
  mobileLiveMode = false,
  messagesClassName,
  showPresenceRail = false,
  showRoomLinks = true
}: ChatRoomPanelProps) {
  const [state, formAction, pending] = useActionState<PublicChatActionState, FormData>(
    publicChatAction,
    initialPublicChatActionState
  );
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [starsPanelOpen, setStarsPanelOpen] = useState(false);
  const [composerToolsOpen, setComposerToolsOpen] = useState(false);
  const [presenceRailOpen, setPresenceRailOpen] = useState(true);
  const [gifQuery, setGifQuery] = useState("rave");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifLoadedQuery, setGifLoadedQuery] = useState("rave");
  const [gifNextOffset, setGifNextOffset] = useState<number | null>(null);
  const [composerBody, setComposerBody] = useState("");
  const [selectedEffectId, setSelectedEffectId] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatReplyTarget | null>(null);
  const [editingMessage, setEditingMessage] = useState<PublicChatMessageRow | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [openMessageActionsId, setOpenMessageActionsId] = useState<string | null>(null);
  const [syncedMessages, setSyncedMessages] = useState<SyncedMessages | null>(null);
  const [syncedPresence, setSyncedPresence] = useState<SyncedPresence | null>(null);
  const [syncedRoom, setSyncedRoom] = useState<PublicChatRoomRow | null>(null);
  const [localStarBalance, setLocalStarBalance] = useState(currentStarBalance);
  const [localSheepFreeThrowAvailable, setLocalSheepFreeThrowAvailable] = useState(sheepFreeThrowAvailable);
  const [sheepCooldownRemaining, setSheepCooldownRemaining] = useState(sheepRemainingCooldownSeconds);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const gifResultsViewportRef = useRef<HTMLDivElement>(null);
  const gifLoadingRef = useRef(false);
  const selectedRoomId = selectedRoom?.id;
  const visibleRoom = syncedRoom && syncedRoom.id === selectedRoomId ? syncedRoom : selectedRoom;
  const visibleMessages = syncedMessages && syncedMessages.roomId === selectedRoomId ? syncedMessages.messages : messages;
  const visiblePresence = syncedPresence && syncedPresence.roomId === selectedRoomId ? syncedPresence.users : presenceUsers;
  const onlinePresenceUserIds = useMemo(
    () => new Set(visiblePresence.filter((user) => user.status === "online").map((user) => user.id)),
    [visiblePresence]
  );
  const latestMessageId = visibleMessages.length ? visibleMessages[visibleMessages.length - 1]?.id : "empty";
  const currentUserCanModerate = hasPermission(currentUser, "moderation.use");
  const currentUserCanClearChat = Boolean(currentUser && (hasRole(currentUser, "admin") || hasRole(currentUser, "owner")));
  const currentUserCanThrowSheep = Boolean(currentUser && hasRole(currentUser, "supporter"));
  const availableThrowSprites = useMemo(() => getAvailableSheepThrowSprites(sheepSettings), [sheepSettings]);
  const defaultThrowSprite = availableThrowSprites[0];
  const effectiveSheepCostStars = localSheepFreeThrowAvailable ? 0 : sheepSettings.costStars;
  const currentUserCanAffordSheep = localStarBalance >= effectiveSheepCostStars;
  const sheepThrowCostLabel = localSheepFreeThrowAvailable
    ? "Free live throw"
    : effectiveSheepCostStars > 0
      ? `${effectiveSheepCostStars.toLocaleString("en-GB")} stars`
      : "Free";
  const sheepCooldownActive = sheepCooldownRemaining > 0;
  const sheepCooldownLabel = formatSheepThrowCooldownLabel(sheepCooldownRemaining);
  const sheepThrowStatusLabel = !sheepSettings.enabled
    ? "Off"
    : sheepCooldownActive
      ? `Wait ${sheepCooldownLabel}`
      : !currentUserCanAffordSheep
        ? `Need ${sheepThrowCostLabel}`
        : sheepThrowCostLabel;
  const sheepThrowDisabledReason = !sheepSettings.enabled
    ? "Sheep throws are disabled."
    : sheepCooldownActive
      ? `Sheep throw cooldown has ${sheepCooldownLabel} remaining.`
      : !currentUserCanAffordSheep
        ? `You need ${sheepThrowCostLabel} to throw sheep.`
        : null;
  const roomLockedForUser = Boolean(visibleRoom?.lockedAt && !currentUserCanModerate);
  const stickerAssets = assets.filter((asset) => asset.kind === "sticker");
  const emojiAssets = assets.filter((asset) => asset.kind === "emoji");
  const liveStarsEnabled = Boolean(selectedRoom && visibleRoom?.type === "live");
  const mentionSuggestions = useMemo<MentionSuggestion[]>(() => {
    const seen = new Set<string>();
    const suggestions: MentionSuggestion[] = [];
    const addSuggestion = (displayName: string, userId: string | null) => {
      const token = mentionTokenFromDisplayName(displayName);
      const key = token.toLowerCase();

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      suggestions.push({
        displayName,
        token,
        userId
      });
    };

    if (currentUser) {
      addSuggestion(currentUser.displayName, currentUser.id);
    }

    for (const user of visiblePresence) {
      addSuggestion(user.displayName, user.id);
    }

    for (const message of visibleMessages) {
      addSuggestion(message.authorDisplayName, message.authorUserId);
    }

    return suggestions.slice(0, 12);
  }, [currentUser, visibleMessages, visiblePresence]);
  const filteredMentionSuggestions = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }

    const normalizedQuery = mentionQuery.toLowerCase();

    return mentionSuggestions
      .filter((suggestion) => suggestion.token.toLowerCase().startsWith(normalizedQuery))
      .slice(0, 6);
  }, [mentionQuery, mentionSuggestions]);
  const activeReplyTarget = replyTarget && visibleMessages.some((message) => message.id === replyTarget.id) ? replyTarget : null;

  const closeComposerPanels = useCallback(() => {
    setComposerToolsOpen(false);
    setGifPanelOpen(false);
    setAssetPanelOpen(false);
    setStarsPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!showPresenceRail) {
      return;
    }

    document.documentElement.style.setProperty("--bc-live-presence-rail-width", presenceRailOpen ? "224px" : "0px");

    return () => {
      document.documentElement.style.removeProperty("--bc-live-presence-rail-width");
    };
  }, [presenceRailOpen, showPresenceRail]);

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
    const payload = (await response.json()) as { messages?: PublicChatMessageRow[]; presenceUsers?: PublicChatPresenceUserRow[] };

    if (response.ok && payload.messages) {
      setSyncedMessages({
        roomId,
        messages: payload.messages
      });

      if (payload.presenceUsers) {
        setSyncedPresence({
          roomId,
          users: payload.presenceUsers
        });
      }
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

      eventSource.addEventListener("presence", (event) => {
        if (!active) {
          return;
        }

        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as ChatPresenceStreamPayload;

          if (payload.presenceUsers) {
            setSyncedPresence({
              roomId,
              users: payload.presenceUsers
            });
          }
        } catch {
          // Ignore malformed presence events and keep the current user list.
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

    const sheepStateTimer =
      state.intent === "sheep"
        ? window.setTimeout(() => {
            setSheepCooldownRemaining(sheepSettings.cooldownSeconds);
            setLocalStarBalance((balance) => Math.max(0, balance - effectiveSheepCostStars));
            setLocalSheepFreeThrowAvailable(false);
          }, 0)
        : null;
    const resetTimer = window.setTimeout(() => {
      setComposerBody("");
      setOpenMessageActionsId(null);
      closeComposerPanels();
      setReplyTarget(null);
      setEditingMessage(null);
      setMentionQuery(null);
    }, 0);
    const syncTimer = selectedRoomId
      ? window.setTimeout(() => {
          void loadLatestMessages(selectedRoomId);
        }, 0)
      : null;

    return () => {
      if (sheepStateTimer !== null) {
        window.clearTimeout(sheepStateTimer);
      }

      window.clearTimeout(resetTimer);

      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
      }
    };
  }, [
    closeComposerPanels,
    effectiveSheepCostStars,
    loadLatestMessages,
    sheepSettings.cooldownSeconds,
    state.intent,
    state.revision,
    state.status,
    selectedRoomId
  ]);

  useEffect(() => {
    scrollToLatestMessage();
  }, [latestMessageId, scrollToLatestMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocalStarBalance(currentStarBalance);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStarBalance]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSheepCooldownRemaining(sheepRemainingCooldownSeconds);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sheepRemainingCooldownSeconds]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocalSheepFreeThrowAvailable(sheepFreeThrowAvailable);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sheepFreeThrowAvailable]);

  useEffect(() => {
    if (!sheepCooldownActive) {
      return;
    }

    const timer = window.setInterval(() => {
      setSheepCooldownRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sheepCooldownActive]);

  useEffect(() => {
    if (!mobileLiveMode || typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const visualViewport = window.visualViewport;

    function updateKeyboardInset() {
      const keyboardInset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);

      document.documentElement.style.setProperty("--bc-mobile-keyboard-inset", `${Math.round(keyboardInset)}px`);
    }

    updateKeyboardInset();
    visualViewport.addEventListener("resize", updateKeyboardInset);
    visualViewport.addEventListener("scroll", updateKeyboardInset);

    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardInset);
      visualViewport.removeEventListener("scroll", updateKeyboardInset);
      document.documentElement.style.removeProperty("--bc-mobile-keyboard-inset");
    };
  }, [mobileLiveMode]);

  function updateMentionQuery(body: string, caretIndex: number) {
    setMentionQuery(getActiveMentionQuery(body, caretIndex));
  }

  function handleComposerChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setComposerBody(event.target.value);
    updateMentionQuery(event.target.value, event.target.selectionStart ?? event.target.value.length);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleComposerCursorMove() {
    const textarea = textareaRef.current;

    if (!textarea) {
      setMentionQuery(null);
      return;
    }

    updateMentionQuery(textarea.value, textarea.selectionStart ?? textarea.value.length);
  }

  function insertMention(displayName: string) {
    const textarea = textareaRef.current;
    const caretIndex = textarea?.selectionStart ?? composerBody.length;
    const result = replaceActiveMention(composerBody, caretIndex, displayName);

    setComposerBody(result.text);
    setMentionQuery(null);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(result.caretIndex, result.caretIndex);
    });
  }

  function startReplyToMessage(message: PublicChatMessageRow) {
    setReplyTarget({
      id: message.id,
      body: message.body,
      kind: message.kind,
      mediaAlt: message.mediaAlt,
      deletedAt: message.deletedAt,
      authorDisplayName: message.authorDisplayName,
      starAmount: message.starAmount,
      starNote: message.starNote
    });
    setOpenMessageActionsId(null);
    textareaRef.current?.focus();
  }

  function startEditingChatMessage(message: PublicChatMessageRow) {
    setEditingMessage(message);
    setOpenMessageActionsId(null);
  }

  function handleComposerFocus() {
    if (!mobileLiveMode) {
      return;
    }

    const keepComposerVisible = () => {
      textareaRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    window.setTimeout(keepComposerVisible, 80);
    window.setTimeout(keepComposerVisible, 320);
  }

  async function loadGifs(query: string, offset = 0, append = false) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setGifError("Enter a GIF search term.");
      return;
    }

    if (gifLoadingRef.current) {
      return;
    }

    gifLoadingRef.current = true;
    setGifLoading(true);
    setGifError(null);

    try {
      const params = new URLSearchParams({
        limit: "48",
        offset: String(offset),
        q: normalizedQuery
      });

      const response = await fetch(`/api/gifs/search?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { nextOffset?: number | null; results?: GifResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "GIF search failed.");
      }

      const nextGifs = payload.results ?? [];

      if (append) {
        setGifResults((currentResults) => {
          const seen = new Set(currentResults.map((gif) => gif.gifUrl.toLowerCase()));
          const uniqueNextGifs = nextGifs.filter((gif) => {
            const key = gif.gifUrl.toLowerCase();

            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          });

          return [...currentResults, ...uniqueNextGifs];
        });
      } else {
        setGifResults(nextGifs);
        gifResultsViewportRef.current?.scrollTo({ top: 0 });
      }

      setGifLoadedQuery(normalizedQuery);
      setGifNextOffset(typeof payload.nextOffset === "number" ? payload.nextOffset : null);
      setGifError(nextGifs.length || append ? null : "No GIFs found.");

    } catch (error) {
      if (!append) {
        setGifResults([]);
        setGifNextOffset(null);
      }

      setGifError(error instanceof Error ? error.message : "GIF search failed.");
    } finally {
      gifLoadingRef.current = false;
      setGifLoading(false);
    }
  }

  async function searchGifs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await loadGifs(gifQuery);
  }

  function handleGifResultsScroll(event: UIEvent<HTMLDivElement>) {
    if (gifNextOffset === null || gifLoadingRef.current) {
      return;
    }

    const viewport = event.currentTarget;
    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (remaining <= 220) {
      void loadGifs(gifLoadedQuery || gifQuery, gifNextOffset, true);
    }
  }

  function renderStarsForm(className?: string, compactStarForm = false) {
    if (!selectedRoom || visibleRoom?.type !== "live") {
      return null;
    }

    return (
      <form
        action={formAction}
        className={cn(
          "grid gap-3 rounded-md border border-bc-acid/25 bg-bc-acid/10 p-3",
          compactStarForm && "gap-2 p-2",
          className
        )}
      >
        <input name="intent" type="hidden" value="stars" />
        <input name="roomId" type="hidden" value={selectedRoom.id} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Star className="h-5 w-5 fill-bc-acid text-bc-acid" aria-hidden="true" />
            <span className="font-black">Send stars</span>
            <Badge tone="acid">{localStarBalance.toLocaleString("en-GB")} available</Badge>
          </div>
          <ButtonLink href="/account/rewards" size="sm" variant="dark">
            Buy stars
          </ButtonLink>
        </div>
        <div className={cn("grid gap-2 sm:grid-cols-[140px_1fr_auto]", compactStarForm && "grid-cols-[minmax(0,1fr)_auto]")}>
          <select
            aria-label="Star amount"
            className={cn(
              "min-h-10 min-w-0 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white",
              compactStarForm && "min-h-8 px-2 py-1 text-xs"
            )}
            name="amount"
          >
            {liveStarSendAmounts.map((amount) => (
              <option key={amount} value={amount}>
                {amount} stars
              </option>
            ))}
          </select>
          <input
            className={cn(
              "min-h-10 min-w-0 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white",
              compactStarForm && "min-h-8 px-2 py-1 text-xs",
              compactStarForm && "col-span-full sm:col-auto"
            )}
            maxLength={160}
            name="note"
            placeholder="Optional stream alert message"
          />
          <Button
            className={cn("min-w-0 px-3", compactStarForm && "min-h-8 px-2 text-xs")}
            disabled={pending || roomLockedForUser || localStarBalance < liveStarSendAmounts[0]}
            type="submit"
            variant="primary"
          >
            <Star className={cn("h-4 w-4", compactStarForm && "h-3.5 w-3.5")} aria-hidden="true" />
            Send
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className={cn("relative min-h-0 min-w-0 overflow-hidden rounded-md border border-bc-line bg-bc-panel lg:overflow-visible", className)}>
      {showPresenceRail ? (
        <ChatPresenceRail
          availableThrowSprites={availableThrowSprites}
          currentUserCanThrowSheep={currentUserCanThrowSheep}
          currentUserId={currentUser?.id ?? null}
          defaultThrowSprite={defaultThrowSprite}
          formAction={formAction}
          open={presenceRailOpen}
          pending={pending}
          roleDisplayLabels={roleDisplayLabels}
          roomId={selectedRoom?.id ?? null}
          roomLockedForUser={roomLockedForUser}
          sheepThrowDisabledReason={sheepThrowDisabledReason}
          sheepThrowStatusLabel={sheepThrowStatusLabel}
          users={visiblePresence}
          onToggle={() => setPresenceRailOpen((open) => !open)}
        />
      ) : null}
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[inherit] bg-inherit">
      {!hideHeader ? (
        <div className={cn("shrink-0 border-b border-bc-line p-4", mobileLiveMode && "p-3")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge tone={visibleRoom ? roomTone(visibleRoom.type) : "muted"}>{visibleRoom?.type ?? "Chat"}</Badge>
              <h2 className={cn("mt-3 font-black", compact ? "text-xl" : "text-2xl", mobileLiveMode && "mt-2 text-lg")}>
                {visibleRoom?.name ?? "Chat rooms"}
              </h2>
              <p className={cn("mt-1 text-sm text-bc-muted", mobileLiveMode && "text-xs lg:text-sm")}>
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
      ) : null}

      <div
        className={cn(
          compact ? "max-h-[380px]" : "max-h-[560px]",
          "min-h-0 overflow-y-auto overflow-x-hidden p-4",
          messagesClassName
        )}
        data-testid="chat-message-list"
        ref={messagesViewportRef}
      >
        <div className="space-y-3">
          {visibleMessages.map((message) => {
            const mediaSize = imageSize(message.mediaWidth, message.mediaHeight);
            const canReportMessage = Boolean(currentUser && message.authorUserId && currentUser.id !== message.authorUserId);
            const canUseMessageActions = Boolean(currentUser && selectedRoom && !message.deletedAt);
            const canEditOwnMessage = canEditChatMessage({
              authorUserId: message.authorUserId,
              currentUserId: currentUser?.id,
              deletedAt: message.deletedAt,
              kind: message.kind
            });
            const canModerateMessage = Boolean(canUseMessageActions && currentUserCanModerate);
            const canBanMessageAuthor = Boolean(canModerateMessage && message.authorUserId && message.authorUserId !== currentUser?.id);
            const canThrowAtMessageAuthor = Boolean(
              canUseMessageActions &&
                currentUserCanThrowSheep &&
                message.authorUserId &&
                message.authorUserId !== currentUser?.id &&
                onlinePresenceUserIds.has(message.authorUserId)
            );
            const messageActionsOpen = openMessageActionsId === message.id;
            const editingThisMessage = editingMessage?.id === message.id;
            const isCustomAssetMessage = (message.kind === "sticker" || message.kind === "emoji") && Boolean(message.mediaUrl);
            const visibleReactionSummaries = message.reactions
              .filter((reaction) => reaction.count > 0)
              .map((summary) => ({
                option: chatReactionOptions.find((option) => option.key === summary.key),
                summary
              }))
              .filter((reaction): reaction is { option: (typeof chatReactionOptions)[number]; summary: (typeof message.reactions)[number] } =>
                Boolean(reaction.option)
              );

            if (message.kind === "sheep") {
              return (
                <article
                  className={cn(
                    "mx-auto max-w-[92%] scroll-mt-24 rounded-full border border-bc-amber/35 bg-bc-amber/10 px-3 py-2 text-center text-xs font-black text-white shadow-[0_0_22px_rgba(255,176,32,0.12)]",
                    mobileLiveMode && "max-w-full bg-black/35 px-2 py-1.5 backdrop-blur-sm"
                  )}
                  id={`chat-message-${message.id}`}
                  key={message.id}
                >
                  <div className="flex min-w-0 items-center justify-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-bc-amber" aria-hidden="true" />
                    <span className="min-w-0 break-words">{message.body}</span>
                    <span className="shrink-0 text-[10px] font-semibold text-bc-muted">{formatTime(message.createdAt)}</span>
                  </div>
                </article>
              );
            }

            return (
              <article
                className={cn(
                  "min-w-0 scroll-mt-24 overflow-hidden rounded-md border border-bc-line bg-bc-ink p-3 target:border-bc-electric target:shadow-[0_0_0_1px_rgba(0,213,255,0.45)]",
                  mobileLiveMode && "border-white/10 bg-black/35 p-2 backdrop-blur-sm lg:bg-black/25 lg:p-2.5 lg:backdrop-blur-none"
                )}
                id={`chat-message-${message.id}`}
                key={message.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md border border-bc-line bg-bc-panel text-xs font-black text-bc-electric",
                        mobileLiveMode && "h-6 w-6 text-[10px] lg:h-7 lg:w-7 lg:text-xs"
                      )}
                    >
                      {message.authorAvatarUrl ? (
                        <Image
                          alt=""
                          className="h-full w-full object-cover"
                          height={28}
                          src={message.authorAvatarUrl}
                          unoptimized
                          width={28}
                        />
                      ) : (
                        authorInitial(message.authorDisplayName)
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 break-words font-semibold">{message.authorDisplayName}</span>
                        {visibleBadgeRoles(message.authorRoles).map((role) => (
                          <Badge className="py-0.5" key={role} tone={roleBadgeTone(role)}>
                            {roleDisplayName(role, roleDisplayLabels)}
                          </Badge>
                        ))}
                      </div>
                      {visibleReactionSummaries.length ? (
                        <div
                          aria-label="Message reactions"
                          className={cn("mt-1 flex min-h-4 flex-wrap items-center gap-2", mobileLiveMode && "mt-0.5 gap-1.5")}
                        >
                          {visibleReactionSummaries.map(({ option, summary }) => (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 text-[11px] font-black leading-none text-bc-muted",
                                summary.reacted && "text-bc-electric",
                                mobileLiveMode && "text-[10px]"
                              )}
                              key={summary.key}
                              title={`${option.label}: ${summary.count.toLocaleString("en-GB")}`}
                            >
                              <span aria-hidden="true">{option.icon}</span>
                              <span>{summary.count.toLocaleString("en-GB")}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <span className="text-xs text-bc-muted">{formatTime(message.createdAt)}</span>
                    {message.editedAt ? <span className="text-[10px] font-semibold text-bc-muted">(edited)</span> : null}
                    {canUseMessageActions ? (
                      <button
                        aria-expanded={messageActionsOpen}
                        aria-label={`Open actions for ${message.authorDisplayName}'s message`}
                        className={cn(
                          "bc-focus-ring inline-grid h-6 w-6 place-items-center rounded-full border text-white transition",
                          messageActionsOpen
                            ? "border-bc-electric/60 bg-bc-electric/15"
                            : "border-bc-line bg-bc-panel hover:border-bc-electric/60"
                        )}
                        onClick={() => setOpenMessageActionsId(messageActionsOpen ? null : message.id)}
                        title="Message actions"
                        type="button"
                      >
                        <Plus className={cn("h-3.5 w-3.5 transition", messageActionsOpen && "rotate-45")} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {message.replyTo ? (
                  <div className="mt-2 rounded-md border-l-2 border-bc-electric/70 bg-bc-panel/70 px-2 py-1.5 text-xs">
                    <div className="flex min-w-0 items-center gap-1 font-black text-bc-electric">
                      <Reply className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Replying to {message.replyTo.authorDisplayName}</span>
                    </div>
                    <p className="mt-1 max-h-10 overflow-hidden break-words text-bc-muted">
                      {chatMessagePreviewText(message.replyTo)}
                    </p>
                  </div>
                ) : null}

                {editingThisMessage ? (
                  <form action={formAction} className="mt-3 grid gap-2 rounded-md border border-bc-electric/30 bg-bc-electric/10 p-2">
                    <input name="intent" type="hidden" value="edit-message" />
                    <input name="roomId" type="hidden" value={selectedRoom?.id ?? message.roomId} />
                    <input name="messageId" type="hidden" value={message.id} />
                    <textarea
                      aria-label="Edit message"
                      className="min-h-20 w-full resize-none rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white outline-none transition placeholder:text-bc-muted focus:border-bc-electric focus:ring-2 focus:ring-bc-electric/20"
                      defaultValue={message.body}
                      maxLength={500}
                      name="body"
                      required
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        className="min-h-8 px-2 text-[11px]"
                        disabled={pending}
                        onClick={() => setEditingMessage(null)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                      <Button className="min-h-8 px-2 text-[11px]" disabled={pending || roomLockedForUser} size="sm" type="submit">
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Save edit
                      </Button>
                    </div>
                  </form>
                ) : message.kind === "stars" ? (
                  <div className="mt-3 rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Star className="h-5 w-5 fill-bc-acid text-bc-acid" aria-hidden="true" />
                      <ChatEffectText
                        body={`${(message.starAmount ?? 0).toLocaleString("en-GB")} stars`}
                        className="!mt-0 text-xl font-black text-bc-acid"
                        effectId="legend"
                      />
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

                {messageActionsOpen && selectedRoom ? (
                  <div className="mt-2 space-y-2 rounded-md border border-bc-line bg-bc-panel/85 p-2">
                    <button
                      className="bc-focus-ring inline-flex min-h-7 items-center gap-1.5 rounded-md border border-bc-line bg-bc-ink px-2 text-xs font-black text-white transition hover:border-bc-electric/60"
                      onClick={() => startReplyToMessage(message)}
                      type="button"
                    >
                      <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                      Reply
                    </button>
                    {canEditOwnMessage ? (
                      <button
                        className="bc-focus-ring inline-flex min-h-7 items-center gap-1.5 rounded-md border border-bc-line bg-bc-ink px-2 text-xs font-black text-white transition hover:border-bc-electric/60"
                        onClick={() => startEditingChatMessage(message)}
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                    ) : null}
                    {canThrowAtMessageAuthor ? (
                      <form action={formAction} className="inline-flex flex-wrap items-center gap-1.5">
                        <input name="intent" type="hidden" value="sheep" />
                        <input name="roomId" type="hidden" value={selectedRoom.id} />
                        <input name="messageId" type="hidden" value={message.id} />
                        {availableThrowSprites.length > 1 ? (
                          <select
                            className="min-h-7 max-w-[9rem] rounded-md border border-bc-line bg-bc-ink px-2 text-xs font-black text-white"
                            defaultValue={defaultThrowSprite?.id}
                            disabled={pending || roomLockedForUser || Boolean(sheepThrowDisabledReason)}
                            name="throwSpriteId"
                            title="Choose what to throw"
                          >
                            {availableThrowSprites.map((sprite) => (
                              <option key={sprite.id} value={sprite.id}>
                                {sprite.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input name="throwSpriteId" type="hidden" value={defaultThrowSprite?.id ?? "sheep"} />
                        )}
                        <Button
                          className="min-h-7 px-2 text-xs"
                          disabled={pending || roomLockedForUser || Boolean(sheepThrowDisabledReason)}
                          size="sm"
                          title={sheepThrowDisabledReason ?? `Throw for ${sheepThrowCostLabel}`}
                          type="submit"
                          variant="ghost"
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          {availableThrowSprites.length > 1 ? "Throw" : `Throw ${(defaultThrowSprite?.label ?? "sheep").toLowerCase()}`}
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                              sheepThrowDisabledReason ? "bg-bc-muted/15 text-bc-muted" : "bg-bc-acid/15 text-bc-acid"
                            )}
                          >
                            {sheepThrowStatusLabel}
                          </span>
                        </Button>
                      </form>
                    ) : null}
                    <div>
                      <p className="text-[11px] font-black uppercase text-bc-muted">Reactions</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {chatReactionOptions.map((reaction) => {
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
                                className={`bc-focus-ring inline-flex min-h-7 items-center gap-1 rounded-full border px-1.5 text-xs transition disabled:opacity-50 ${
                                  summary?.reacted
                                    ? "border-bc-electric/60 bg-bc-electric/15 text-white"
                                    : "border-bc-line bg-bc-ink text-bc-muted hover:border-bc-electric/50 hover:text-white"
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
                        })}
                      </div>
                    </div>

                    {canReportMessage ? (
                      <form action={formAction} className="flex flex-wrap items-center gap-1.5 border-t border-bc-line pt-2">
                        <input name="intent" type="hidden" value="report" />
                        <input name="roomId" type="hidden" value={selectedRoom.id} />
                        <input name="messageId" type="hidden" value={message.id} />
                        <input name="reportNotes" type="hidden" value="Reported from the live chat action menu." />
                        <select
                          aria-label="Report reason"
                          className="min-h-8 min-w-0 flex-1 rounded-md border border-bc-line bg-bc-ink px-2 py-1 text-xs text-white"
                          defaultValue="spam"
                          name="reason"
                        >
                          {reportReasonOptions.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                        <Button className="min-h-8 px-2 text-[11px]" disabled={pending} size="sm" type="submit" variant="dark">
                          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                          Report user
                        </Button>
                      </form>
                    ) : null}

                    {canModerateMessage ? (
                      <div className="space-y-2 border-t border-bc-line pt-2">
                        <p className="text-[11px] font-black uppercase text-bc-muted">Moderation</p>
                        <form action={formAction} className="flex flex-wrap items-center gap-1.5">
                          <input name="intent" type="hidden" value="delete-message" />
                          <input name="roomId" type="hidden" value={selectedRoom.id} />
                          <input name="messageId" type="hidden" value={message.id} />
                          <Button className="min-h-8 px-2 text-[11px]" disabled={pending} size="sm" type="submit" variant="pink">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Remove message
                          </Button>
                        </form>

                        {canBanMessageAuthor ? (
                          <form action={formAction} className="grid gap-1.5">
                            <input name="intent" type="hidden" value="ban-user" />
                            <input name="roomId" type="hidden" value={selectedRoom.id} />
                            <input name="targetUserId" type="hidden" value={message.authorUserId ?? ""} />
                            <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                              <select
                                aria-label="Ban duration"
                                className="min-h-8 min-w-0 rounded-md border border-bc-line bg-bc-ink px-2 py-1 text-xs text-white"
                                defaultValue="24h"
                                name="duration"
                              >
                                {inlineBanDurationOptions.map((duration) => (
                                  <option key={duration.value} value={duration.value}>
                                    {duration.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="Ban reason"
                                className="min-h-8 min-w-0 rounded-md border border-bc-line bg-bc-ink px-2 py-1 text-xs text-white"
                                defaultValue="spam"
                                name="banReason"
                              >
                                {reportReasonOptions.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              className="min-h-8 min-w-0 rounded-md border border-bc-line bg-bc-ink px-2 py-1 text-xs text-white"
                              maxLength={160}
                              name="banNotes"
                              placeholder="Optional moderation note"
                            />
                            <Button className="min-h-8 px-2 text-[11px]" disabled={pending} size="sm" type="submit" variant="dark">
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                              Ban user from chat
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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

      <div
        className={cn(
          "shrink-0 border-t border-bc-line p-4",
          mobileLiveMode &&
            "sticky bottom-0 z-30 max-h-[38dvh] overflow-y-auto bg-bc-panel/95 p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom)+var(--bc-mobile-keyboard-inset,0px))] backdrop-blur-md lg:static lg:max-h-none lg:overflow-visible lg:bg-transparent lg:p-3 lg:backdrop-blur-none"
        )}
      >
        {state.message ? (
          <div
            className={`mb-2 rounded-md border p-2 text-xs ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {currentUser && selectedRoom ? (
          <div className={cn("grid gap-3", mobileLiveMode && "gap-2")}>
            {roomLockedForUser ? (
              <div className="rounded-md border border-bc-pink/30 bg-bc-pink/10 p-2 text-xs text-bc-pink">
                This chat room is locked by moderation.
              </div>
            ) : null}
            <form action={formAction} className={cn("grid gap-3", mobileLiveMode && "gap-2 lg:gap-3")}>
              <input name="intent" type="hidden" value="text" />
              <input name="roomId" type="hidden" value={selectedRoom.id} />
              {activeReplyTarget ? <input name="replyToMessageId" type="hidden" value={activeReplyTarget.id} /> : null}
              {activeReplyTarget ? (
                <div className="rounded-md border border-bc-electric/35 bg-bc-electric/10 px-2 py-1.5 text-xs">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 font-black text-bc-electric">
                      <Reply className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Replying to {activeReplyTarget.authorDisplayName}</span>
                    </div>
                    <button
                      aria-label="Cancel reply"
                      className="bc-focus-ring inline-grid h-6 w-6 shrink-0 place-items-center rounded-full border border-bc-line bg-bc-panel text-bc-muted transition hover:text-white"
                      onClick={() => setReplyTarget(null)}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-1 max-h-10 overflow-hidden break-words text-bc-muted">{chatMessagePreviewText(activeReplyTarget)}</p>
                </div>
              ) : null}
              <textarea
                className={cn(
                  "min-h-24 min-w-0 resize-y rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white",
                  mobileLiveMode && "min-h-9 max-h-14 resize-none px-2 py-1 text-xs lg:min-h-16 lg:max-h-24 lg:px-3 lg:py-2 lg:text-sm"
                )}
                maxLength={500}
                name="body"
                onChange={handleComposerChange}
                onClick={handleComposerCursorMove}
                onFocus={handleComposerFocus}
                onKeyDown={handleComposerKeyDown}
                onKeyUp={handleComposerCursorMove}
                onSelect={handleComposerCursorMove}
                placeholder={`Message #${visibleRoom?.slug ?? selectedRoom.slug}`}
                ref={textareaRef}
                disabled={roomLockedForUser}
                required
                value={composerBody}
              />
              {filteredMentionSuggestions.length ? (
                <div className="grid gap-1 rounded-md border border-bc-line bg-bc-ink p-1.5">
                  <div className="flex items-center gap-1 px-1 text-[11px] font-black uppercase text-bc-muted">
                    <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                    Mentions
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {filteredMentionSuggestions.map((suggestion) => (
                      <button
                        className="bc-focus-ring inline-flex min-h-7 min-w-0 items-center gap-1 rounded-full border border-bc-line bg-bc-panel px-2 text-xs font-black text-white transition hover:border-bc-electric/60"
                        key={`${suggestion.userId ?? "guest"}-${suggestion.token}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertMention(suggestion.displayName)}
                        title={`Mention ${suggestion.displayName}`}
                        type="button"
                      >
                        <AtSign className="h-3 w-3 shrink-0 text-bc-electric" aria-hidden="true" />
                        <span className="truncate">{suggestion.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {composerBody.trim() && selectedEffectId ? (
                <div className={cn("rounded-md border border-bc-line bg-bc-ink px-3 py-2", mobileLiveMode && "max-h-16 overflow-hidden px-2 py-1.5 lg:max-h-none lg:px-3 lg:py-2")}>
                  <div className="text-xs font-semibold uppercase text-bc-muted">Preview</div>
                  <ChatEffectText body={composerBody} className="mt-2" effectId={selectedEffectId} />
                </div>
              ) : null}
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3",
                  mobileLiveMode &&
                    "sticky bottom-0 z-20 -mx-1.5 -mb-1.5 border-t border-bc-line bg-bc-panel/90 px-1.5 py-1 backdrop-blur-md lg:static lg:m-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
                )}
              >
                <p className={cn("text-xs text-bc-muted", mobileLiveMode && "hidden lg:block")}>
                  Press Enter to send message. Shift+Enter for line break.
                </p>
                <div
                  className={cn(
                    "flex w-full min-w-0 flex-wrap justify-start gap-2 sm:w-auto sm:justify-end",
                    mobileLiveMode &&
                      "grid w-full grid-cols-[8.5rem_2rem_3.5rem] gap-1 overflow-visible pb-0 lg:w-auto lg:flex lg:flex-wrap lg:gap-2"
                  )}
                >
                  <ChatEffectSelector
                    className={cn(
                      "text-[10px] sm:text-xs",
                      mobileLiveMode && "lg:text-xs"
                    )}
                    disabled={roomLockedForUser}
                    onChange={setSelectedEffectId}
                    selectedEffectId={selectedEffectId}
                    userRoles={currentUser.roles}
                  />
                  <Button
                    aria-expanded={composerToolsOpen}
                    aria-label="Open chat tools"
                    className={cn("h-8 min-h-8 w-8 shrink-0 px-0 text-[0px]", mobileLiveMode && "lg:h-8 lg:w-8 lg:px-0")}
                    disabled={roomLockedForUser && !currentUserCanClearChat}
                    onClick={() => {
                      if (composerToolsOpen || gifPanelOpen || assetPanelOpen || starsPanelOpen) {
                        closeComposerPanels();
                        return;
                      }

                      setComposerToolsOpen(true);
                    }}
                    type="button"
                    variant={composerToolsOpen ? "dark" : "ghost"}
                  >
                    <Plus className={cn("h-3.5 w-3.5 shrink-0 transition", composerToolsOpen && "rotate-45")} aria-hidden="true" />
                    <span className="sr-only">Chat tools</span>
                  </Button>
                  <Button
                    className={cn("h-8 min-h-8 shrink-0 px-2 text-[11px]", mobileLiveMode && "lg:h-8 lg:min-h-8 lg:px-3 lg:text-xs")}
                    disabled={pending || roomLockedForUser}
                    type="submit"
                    variant="primary"
                  >
                    <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Send
                  </Button>
                </div>
              </div>
            </form>

            {composerToolsOpen ? (
              <section className={cn("rounded-md border border-bc-line bg-bc-ink p-2", mobileLiveMode && "p-1.5")}>
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                  {liveStarsEnabled ? (
                    <Button
                      className="min-h-8 px-2 text-xs"
                      disabled={roomLockedForUser}
                      onClick={() => {
                        setStarsPanelOpen((open) => !open);
                        setGifPanelOpen(false);
                        setAssetPanelOpen(false);
                        setComposerToolsOpen(false);
                      }}
                      type="button"
                      variant={starsPanelOpen ? "dark" : "ghost"}
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      Stars
                    </Button>
                  ) : null}
                  <Button
                    className="min-h-8 px-2 text-xs"
                    disabled={roomLockedForUser}
                    onClick={() => {
                      setGifPanelOpen((open) => !open);
                      setAssetPanelOpen(false);
                      setStarsPanelOpen(false);
                      setComposerToolsOpen(false);
                    }}
                    type="button"
                    variant={gifPanelOpen ? "dark" : "ghost"}
                  >
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    GIF
                  </Button>
                  <Button
                    className="min-h-8 px-2 text-xs"
                    disabled={roomLockedForUser}
                    onClick={() => {
                      setAssetPanelOpen((open) => !open);
                      setGifPanelOpen(false);
                      setStarsPanelOpen(false);
                      setComposerToolsOpen(false);
                    }}
                    type="button"
                    variant={assetPanelOpen ? "dark" : "ghost"}
                  >
                    <Smile className="h-3.5 w-3.5" aria-hidden="true" />
                    Stickers
                  </Button>
                  {currentUserCanClearChat ? (
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="clear-room" />
                      <input name="roomId" type="hidden" value={selectedRoom.id} />
                      <Button className="w-full min-h-8 px-2 text-xs" disabled={pending} size="sm" type="submit" variant="pink">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Clear
                      </Button>
                    </form>
                  ) : null}
                </div>
              </section>
            ) : null}

            {starsPanelOpen ? renderStarsForm(undefined, true) : null}

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
                  <span className="text-xs font-semibold text-bc-muted">Unified search</span>
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

                {gifLoading && !gifResults.length ? <p className="mt-3 text-sm text-bc-muted">Loading GIFs...</p> : null}
                {gifError ? <p className="mt-3 text-sm text-bc-muted">{gifError}</p> : null}

                {gifResults.length ? (
                  <div
                    className="mt-3 max-h-[22rem] overflow-y-auto pr-1"
                    onScroll={handleGifResultsScroll}
                    ref={gifResultsViewportRef}
                  >
                    <div
                      className={`grid gap-2 ${
                        compact ? "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                      }`}
                    >
                      {gifResults.map((gif, index) => {
                        const resultSize = imageSize(gif.width, gif.height);

                        return (
                          <form action={formAction} key={`${gif.id}-${index}`}>
                            <input name="intent" type="hidden" value="gif" />
                            <input name="roomId" type="hidden" value={selectedRoom.id} />
                            <input name="gifId" type="hidden" value={gif.id} />
                            <input name="gifProvider" type="hidden" value={gif.provider} />
                            <input name="gifUrl" type="hidden" value={gif.gifUrl} />
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
                    {gifLoading ? <p className="py-3 text-center text-xs font-semibold text-bc-muted">Loading more GIFs...</p> : null}
                    {!gifLoading && gifNextOffset === null ? (
                      <p className="py-3 text-center text-xs font-semibold text-bc-muted">End of results.</p>
                    ) : null}
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
      </div>
    </section>
  );
}
