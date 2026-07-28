"use client";

import Image from "next/image";
import { Check, Clock3, Flag, Gamepad2, LoaderCircle, LogOut, Map, MessageCircle, RefreshCw, Send, Swords, Trophy, UserRoundPlus, Users, Vote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoreFpsGameFrame } from "@/app/games/core/play/core-fps-game-frame";
import { CoreFpsPresenceTracker } from "@/app/games/core/play/core-fps-presence-tracker";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import type { CoreFpsLobbyPublicState } from "@/lib/games/core-fps-lobby-core";
import { cn } from "@/lib/utils";

type CoreFpsLobbyStageProps = {
  initialLobby: CoreFpsLobbyPublicState;
  initialLaunch: {
    launchUrl: string;
    sessionId: string;
  } | null;
};

function remainingSeconds(deadline: string) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

function PersonAvatar({
  avatarUrl,
  displayName
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-bc-line bg-bc-ink text-xs font-black text-bc-electric">
      {avatarUrl ? (
        <Image alt="" className="h-full w-full object-cover" height={32} src={avatarUrl} unoptimized width={32} />
      ) : (
        displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function CoreFpsLobbyStage({
  initialLobby,
  initialLaunch
}: CoreFpsLobbyStageProps) {
  const [lobby, setLobby] = useState(initialLobby);
  const [launch, setLaunch] = useState(initialLaunch);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(() => remainingSeconds(initialLobby.joinDeadline));
  const [invitePanelOpen, setInvitePanelOpen] = useState(initialLobby.status === "waiting");
  const [invitePending, setInvitePending] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [votePending, setVotePending] = useState<string | null>(null);
  const lobbyEndpoint = `/api/games/core/lobbies/${encodeURIComponent(initialLobby.id)}`;

  const refreshLobby = useCallback(async () => {
    const response = await fetch(lobbyEndpoint, {
      cache: "no-store",
      credentials: "same-origin"
    });
    const payload = (await response.json()) as {
      error?: string;
      lobby?: CoreFpsLobbyPublicState;
    };

    if (!response.ok || !payload.lobby) {
      throw new Error(payload.error ?? "Lobby status could not be refreshed.");
    }

    setLobby(payload.lobby);
    setLoadError(null);
  }, [lobbyEndpoint]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds(remainingSeconds(lobby.joinDeadline));
    }, 250);

    return () => window.clearInterval(timer);
  }, [lobby.joinDeadline]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      void refreshLobby().catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Lobby connection was interrupted.");
      });
    }, 2_000);

    return () => window.clearInterval(poll);
  }, [refreshLobby]);

  useEffect(() => {
    if (lobby.status !== "active" || launch || launchError) {
      return;
    }

    let cancelled = false;

    void fetch(`${lobbyEndpoint}/launch`, {
      cache: "no-store",
      credentials: "same-origin",
      method: "POST"
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          error?: string;
          launch?: {
            launchUrl: string;
            sessionId: string;
          };
        };

        if (!response.ok || !payload.launch) {
          throw new Error(payload.error ?? "The winning arena could not launch.");
        }

        if (!cancelled) {
          setLaunch(payload.launch);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLaunchError(error instanceof Error ? error.message : "The winning arena could not launch.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [launch, launchError, lobby.status, lobbyEndpoint]);

  useEffect(() => {
    const leave = () => {
      navigator.sendBeacon(
        lobbyEndpoint,
        new Blob([], {
          type: "application/json"
        })
      );
    };

    window.addEventListener("pagehide", leave);

    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [lobbyEndpoint]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = window.setTimeout(() => setFeedback(null), 2_500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (lobby.status !== "completed") {
      return;
    }

    const timer = window.setTimeout(() => {
      window.location.assign("/games/core");
    }, 6_000);

    return () => window.clearTimeout(timer);
  }, [lobby.status]);

  const inviteAllLabel = useMemo(
    () =>
      lobby.availableInvitees.length
        ? `Invite all ${lobby.availableInvitees.length}`
        : "No online players",
    [lobby.availableInvitees.length]
  );

  const leaveLobby = useCallback(async () => {
    setLeaving(true);

    try {
      await fetch(lobbyEndpoint, {
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
        method: "POST"
      });
    } finally {
      window.location.assign("/games/core");
    }
  }, [lobbyEndpoint]);

  const invite = useCallback(
    async (targetUserId?: string) => {
      setInvitePending(targetUserId ?? "all");
      setFeedback(null);

      try {
        const response = await fetch(`${lobbyEndpoint}/invite`, {
          body: JSON.stringify({
            targetUserId: targetUserId ?? null
          }),
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const payload = (await response.json()) as {
          error?: string;
          invitedUserCount?: number;
          repeatedUserCount?: number;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Invitation could not be sent.");
        }

        if (payload.invitedUserCount) {
          setFeedback(
            `${payload.invitedUserCount.toLocaleString("en-GB")} ${payload.invitedUserCount === 1 ? "player" : "players"} invited.`
          );
        } else if (payload.repeatedUserCount) {
          setFeedback("That invitation was already sent moments ago.");
        } else {
          setFeedback("No other online players are available to invite.");
        }
        await refreshLobby();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Invitation could not be sent.");
      } finally {
        setInvitePending(null);
      }
    },
    [lobbyEndpoint, refreshLobby]
  );

  const castVote = useCallback(
    async (kind: "map" | "mode", value: string) => {
      const pendingKey = `${kind}:${value}`;
      setVotePending(pendingKey);
      setFeedback(null);

      try {
        const response = await fetch(`${lobbyEndpoint}/vote`, {
          body: JSON.stringify(kind === "map" ? { mapName: value } : { modeName: value }),
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const payload = (await response.json()) as {
          error?: string;
          lobby?: CoreFpsLobbyPublicState;
        };

        if (!response.ok || !payload.lobby) {
          throw new Error(payload.error ?? "Your vote could not be saved.");
        }

        setLobby(payload.lobby);
        setFeedback("Vote saved.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Your vote could not be saved.");
      } finally {
        setVotePending(null);
      }
    },
    [lobbyEndpoint]
  );

  const active = lobby.status === "active";

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {active && launch ? (
        <>
          <CoreFpsPresenceTracker sessionId={launch.sessionId} />
          <CoreFpsGameFrame launchUrl={launch.launchUrl} />
        </>
      ) : active ? (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(0,213,255,0.12),transparent_42%),#03040a] px-4">
          <section className="w-full max-w-lg border-y border-bc-line bg-bc-panel/95 px-5 py-8 text-center">
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-bc-electric" aria-hidden="true" />
            <Badge className="mt-4" tone="cyan">Vote locked</Badge>
            <h2 className="mt-4 text-2xl font-black">
              {lobby.modeVotes.find((option) => option.id === lobby.modeName)?.displayName ?? "Arena"} on{" "}
              <span className="capitalize">{lobby.mapName}</span>
            </h2>
            <p className="mt-2 text-sm text-bc-muted">
              Preparing the signed match connection for every player.
            </p>
            {launchError ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-bc-amber">{launchError}</p>
                <Button className="mt-3" onClick={() => setLaunchError(null)} size="sm" type="button" variant="ghost">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry launch
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      ) : lobby.status === "completed" ? (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-[radial-gradient(circle_at_50%_35%,rgba(166,255,0,0.12),transparent_40%),#03040a] px-4 py-6">
          <section className="w-full max-w-xl border-y border-bc-line bg-bc-panel/95 px-5 py-8 text-center md:px-8">
            <Trophy className="mx-auto h-11 w-11 text-bc-acid" aria-hidden="true" />
            <Badge className="mt-4" tone="acid">Match complete</Badge>
            <h2 className="mt-4 text-3xl font-black">Scores saved</h2>
            <p className="mt-3 text-sm text-bc-muted">
              The final result is being posted to chat. You will return to the Core FPS hub automatically.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/games/core" size="sm">
                <Gamepad2 className="h-4 w-4" aria-hidden="true" />
                View scores
              </ButtonLink>
              <ButtonLink href="/chat" size="sm" variant="ghost">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Open chat
              </ButtonLink>
            </div>
          </section>
        </div>
      ) : (
        <div className="absolute inset-0 overflow-y-auto bg-[radial-gradient(circle_at_50%_28%,rgba(0,213,255,0.13),transparent_42%),#03040a] px-4 py-6">
          <div className="mx-auto grid min-h-full w-full max-w-5xl place-items-center">
            <section className="w-full border-y border-bc-line bg-bc-panel/95 px-4 py-6 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="acid">Lobby open</Badge>
                      <Badge tone="cyan">{lobby.participants.length} joined</Badge>
                    </div>
                    <h2 className="mt-4 text-3xl font-black">Players are joining</h2>
                    <p className="mt-2 max-w-2xl text-sm text-bc-muted">
                      The game starts when the countdown ends. If only one player arrives, Bounce Bot fills the opponent slot.
                    </p>
                  </div>
                  <Button
                    className="min-h-8 px-2"
                    disabled={leaving}
                    onClick={() => void leaveLobby()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Leave lobby
                  </Button>
                </div>
                <div className="grid min-w-32 place-items-center rounded-md border border-bc-amber/40 bg-bc-amber/10 p-4 text-center">
                  <Clock3 className="h-5 w-5 text-bc-amber" aria-hidden="true" />
                  <span className="mt-2 text-3xl font-black tabular-nums">{seconds}s</span>
                  <span className="text-[10px] font-bold uppercase text-bc-muted">Until launch</span>
                </div>
              </div>

              <LobbyVotePanel
                lobby={lobby}
                onVote={castVote}
                votePending={votePending}
              />

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                    <h3 className="font-black">Lobby players</h3>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {lobby.participants.map((participant) => (
                      <article className="flex min-w-0 items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3" key={participant.id}>
                        <PersonAvatar avatarUrl={participant.avatarUrl} displayName={participant.displayName} />
                        <span className="truncate text-sm font-bold">{participant.displayName}</span>
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-bc-acid shadow-[0_0_10px_rgba(166,255,0,0.7)]" title="Ready" />
                      </article>
                    ))}
                  </div>
                </div>

                <InvitePanel
                  feedback={feedback}
                  inviteAllLabel={inviteAllLabel}
                  invitePending={invitePending}
                  lobby={lobby}
                  onInvite={invite}
                />
              </div>
              {loadError ? (
                <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-bc-amber">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {loadError} Retrying automatically.
                </p>
              ) : null}
            </section>
          </div>
        </div>
      )}

      {active ? (
        <div className="absolute left-3 top-3 z-40">
          <div className="flex items-center gap-2">
            <Button
              className="min-h-8 bg-black/90 px-2 text-xs backdrop-blur-sm"
              onClick={() => setInvitePanelOpen((current) => !current)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {invitePanelOpen ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <UserRoundPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              {invitePanelOpen ? "Close" : "Invite"}
            </Button>
            <Button
              className="min-h-8 bg-black/90 px-2 text-xs backdrop-blur-sm"
              disabled={leaving}
              onClick={() => void leaveLobby()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Leave
            </Button>
          </div>
          {invitePanelOpen ? (
            <div className="mt-2 w-[min(21rem,calc(100vw-1.5rem))] rounded-md border border-bc-line bg-bc-panel/95 p-3 shadow-2xl backdrop-blur-md">
              <InvitePanel
                compact
                feedback={feedback}
                inviteAllLabel={inviteAllLabel}
                invitePending={invitePending}
                lobby={lobby}
                onInvite={invite}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LobbyVotePanel({
  lobby,
  onVote,
  votePending
}: {
  lobby: CoreFpsLobbyPublicState;
  onVote: (kind: "map" | "mode", value: string) => Promise<void>;
  votePending: string | null;
}) {
  return (
    <section className="mt-6 border-y border-bc-line py-5" aria-labelledby="core-fps-vote-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-bc-acid" aria-hidden="true" />
          <h3 className="font-black" id="core-fps-vote-title">Vote for the match</h3>
        </div>
        <span className="text-xs font-semibold text-bc-muted">One map vote and one mode vote per player</span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <fieldset>
          <legend className="flex items-center gap-2 text-xs font-black uppercase text-bc-muted">
            <Swords className="h-4 w-4 text-bc-electric" aria-hidden="true" />
            Game mode
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {lobby.modeVotes.map((option) => {
              const pending = votePending === `mode:${option.id}`;
              const Icon = option.id === "ctf" ? Flag : Swords;

              return (
                <button
                  aria-pressed={option.selected}
                  className={cn(
                    "bc-focus-ring relative min-h-24 rounded-md border px-3 py-3 text-left transition-colors",
                    option.selected
                      ? "border-bc-acid bg-bc-acid/10 text-white"
                      : "border-bc-line bg-bc-ink text-white hover:border-bc-electric/60 hover:bg-bc-electric/5"
                  )}
                  disabled={!lobby.votingOpen || Boolean(votePending)}
                  key={option.id}
                  onClick={() => void onVote("mode", option.id)}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-2">
                    <Icon className={cn("h-4 w-4", option.id === "ctf" ? "text-bc-pink" : "text-bc-electric")} aria-hidden="true" />
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-black/35 px-1.5 py-0.5 text-[10px] font-black tabular-nums">
                      {option.votes}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs font-black">{option.displayName}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-bc-muted">{option.description}</span>
                  {option.selected ? (
                    <Check className="absolute bottom-2 right-2 h-3.5 w-3.5 text-bc-acid" aria-label="Your vote" />
                  ) : pending ? (
                    <LoaderCircle className="absolute bottom-2 right-2 h-3.5 w-3.5 animate-spin text-bc-electric" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="flex items-center gap-2 text-xs font-black uppercase text-bc-muted">
            <Map className="h-4 w-4 text-bc-pink" aria-hidden="true" />
            Arena map
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {lobby.mapVotes.map((option) => {
              const pending = votePending === `map:${option.id}`;

              return (
                <button
                  aria-pressed={option.selected}
                  className={cn(
                    "bc-focus-ring relative min-h-20 rounded-md border px-3 py-3 text-left transition-colors",
                    option.selected
                      ? "border-bc-pink bg-bc-pink/10 text-white"
                      : "border-bc-line bg-bc-ink text-white hover:border-bc-pink/60 hover:bg-bc-pink/5"
                  )}
                  disabled={!lobby.votingOpen || Boolean(votePending)}
                  key={option.id}
                  onClick={() => void onVote("map", option.id)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black">{option.displayName}</span>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-black/35 px-1.5 py-0.5 text-[10px] font-black tabular-nums">
                      {option.votes}
                    </span>
                  </span>
                  <span className="mt-1 block pr-5 text-[10px] leading-4 text-bc-muted">
                    {option.description}
                  </span>
                  {option.selected ? (
                    <Check className="absolute bottom-2 right-2 h-3.5 w-3.5 text-bc-pink" aria-label="Your vote" />
                  ) : pending ? (
                    <LoaderCircle className="absolute bottom-2 right-2 h-3.5 w-3.5 animate-spin text-bc-pink" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

function InvitePanel({
  compact = false,
  feedback,
  inviteAllLabel,
  invitePending,
  lobby,
  onInvite
}: {
  compact?: boolean;
  feedback: string | null;
  inviteAllLabel: string;
  invitePending: string | null;
  lobby: CoreFpsLobbyPublicState;
  onInvite: (targetUserId?: string) => Promise<void>;
}) {
  return (
    <div className={cn(!compact && "rounded-md border border-bc-line bg-bc-ink p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">Invite online chatters</p>
          <p className="mt-0.5 text-xs text-bc-muted">Invites remain available after the match starts.</p>
        </div>
        <Button
          className="min-h-8 px-2"
          disabled={Boolean(invitePending) || !lobby.availableInvitees.length}
          onClick={() => void onInvite()}
          size="sm"
          type="button"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {inviteAllLabel}
        </Button>
      </div>
      <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
        {lobby.availableInvitees.map((user) => (
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-bc-line bg-black/20 p-2" key={user.id}>
            <PersonAvatar avatarUrl={user.avatarUrl} displayName={user.displayName} />
            <span className="min-w-0 flex-1 truncate text-xs font-bold">{user.displayName}</span>
            <Button
              className="min-h-7 px-2 text-[10px]"
              disabled={Boolean(invitePending)}
              onClick={() => void onInvite(user.id)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <UserRoundPlus className="h-3 w-3" aria-hidden="true" />
              Invite
            </Button>
          </div>
        ))}
        {!lobby.availableInvitees.length ? (
          <p className="py-3 text-center text-xs text-bc-muted">No other online chatters are available to invite.</p>
        ) : null}
      </div>
      {feedback ? (
        <p className="mt-3 rounded-md border border-bc-acid/30 bg-bc-acid/10 px-2 py-1.5 text-xs font-semibold text-bc-acid">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
