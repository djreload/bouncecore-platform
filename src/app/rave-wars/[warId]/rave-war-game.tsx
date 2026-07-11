"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Crosshair, Flag, HeartPulse, Radio, Swords, Timer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RaveWarSummary } from "@/lib/rave-wars/rave-war-types";

type RaveWarGameProps = {
  currentUserId: string;
  initialWar: RaveWarSummary;
};

type WarPayload = {
  error?: string;
  war?: RaveWarSummary;
};

function playerInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function percent(value: number, max: number) {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

function formatStatus(status: string) {
  return status.replace(/-/g, " ").toUpperCase();
}

function healthTone(health: number) {
  if (health > 65) {
    return "bg-bc-acid";
  }

  if (health > 25) {
    return "bg-bc-amber";
  }

  return "bg-bc-pink";
}

export function RaveWarGame({ currentUserId, initialWar }: RaveWarGameProps) {
  const [war, setWar] = useState(initialWar);
  const currentPlayer = war.state.players.find((player) => player.userId === currentUserId) ?? null;
  const activePlayer = war.state.players.find((player) => player.userId === war.turnUserId) ?? null;
  const opponent = war.state.players.find((player) => player.userId !== currentUserId) ?? null;
  const winner = war.winnerUserId ? war.state.players.find((player) => player.userId === war.winnerUserId) : null;
  const [angle, setAngle] = useState(currentPlayer?.angle ?? 45);
  const [power, setPower] = useState(currentPlayer?.power ?? 68);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapStyle = useMemo(
    () => ({
      backgroundColor: war.level.backgroundColor,
      backgroundImage: `url(${war.level.mapImageUrl})`
    }),
    [war.level.backgroundColor, war.level.mapImageUrl]
  );
  const canFire = war.status === "active" && war.turnUserId === currentUserId && !busy;
  const canAccept = war.status === "pending" && war.currentUserRole === "target";

  const applyWar = useCallback((nextWar: RaveWarSummary) => {
    setWar(nextWar);
    setError(null);

    const nextCurrentPlayer = nextWar.state.players.find((player) => player.userId === currentUserId);

    if (nextCurrentPlayer) {
      setAngle(nextCurrentPlayer.angle);
      setPower(nextCurrentPlayer.power);
    }
  }, [currentUserId]);

  const refreshWarFromPayload = useCallback((payload: WarPayload) => {
    if (payload.war) {
      applyWar(payload.war);
    } else if (payload.error) {
      setError(payload.error);
    }
  }, [applyWar]);

  const postWarAction = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);

      try {
        const response = await fetch(`/api/rave-wars/${encodeURIComponent(war.id)}/actions`, {
          body: JSON.stringify({
            action,
            ...body
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const payload = (await response.json()) as WarPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Rave War action failed.");
        }

        refreshWarFromPayload(payload);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Rave War action failed.");
      } finally {
        setBusy(false);
      }
    },
    [refreshWarFromPayload, war.id]
  );

  const postChallengeAction = useCallback(
    async (action: "accept" | "decline") => {
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/rave-wars/challenges", {
          body: JSON.stringify({
            action,
            warId: war.id
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const payload = (await response.json()) as WarPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Rave War challenge action failed.");
        }

        refreshWarFromPayload(payload);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Rave War challenge action failed.");
      } finally {
        setBusy(false);
      }
    },
    [refreshWarFromPayload, war.id]
  );

  useEffect(() => {
    let active = true;
    let fallbackInterval: number | null = null;
    let eventSource: EventSource | null = null;

    async function refreshWar() {
      try {
        const response = await fetch(`/api/rave-wars/${encodeURIComponent(war.id)}/stream`, {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }
      } catch {
        // The EventSource path handles live updates; fetch fallback is only a liveness nudge.
      }
    }

    function startPollingFallback() {
      if (fallbackInterval !== null) {
        return;
      }

      fallbackInterval = window.setInterval(() => {
        window.location.reload();
      }, 10000);
    }

    if ("EventSource" in window) {
      eventSource = new EventSource(`/api/rave-wars/${encodeURIComponent(war.id)}/stream`);

      eventSource.addEventListener("war", (event) => {
        if (!active) {
          return;
        }

        try {
          refreshWarFromPayload(JSON.parse((event as MessageEvent<string>).data) as WarPayload);
        } catch {
          // Ignore malformed stream events.
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
      void refreshWar();
      startPollingFallback();
    }

    return () => {
      active = false;
      eventSource?.close();

      if (fallbackInterval !== null) {
        window.clearInterval(fallbackInterval);
      }
    };
  }, [refreshWarFromPayload, war.id]);

  return (
    <section className="mx-auto flex h-full min-h-[calc(100dvh-97px)] w-full max-w-[1680px] flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-panel p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/45 bg-bc-electric/10 text-bc-electric">
            <Swords className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={war.status === "active" ? "acid" : war.status === "finished" ? "pink" : "cyan"}>{formatStatus(war.status)}</Badge>
              <Badge tone="muted">#{war.roomSlug}</Badge>
            </div>
            <h1 className="mt-1 truncate text-xl font-black">{war.level.name}</h1>
          </div>
        </div>
        <Link className="bc-focus-ring rounded-md border border-bc-line px-3 py-2 text-sm font-semibold text-white transition hover:border-bc-electric/60" href="/live">
          Back to live
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 rounded-md border border-bc-line bg-bc-panel p-2">
          <div
            className="relative mx-auto aspect-[2/1] max-h-[calc(100dvh-190px)] min-h-[260px] overflow-hidden rounded-md border border-bc-line bg-cover bg-center"
            style={mapStyle}
          >
            {war.state.lastShot?.path.length ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${war.level.width} ${war.level.height}`} aria-hidden="true">
                <polyline
                  fill="none"
                  points={war.state.lastShot.path.map((point) => `${point.x},${point.y}`).join(" ")}
                  stroke="#a3ff12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="8"
                />
                <circle
                  cx={war.state.lastShot.impactPoint.x}
                  cy={war.state.lastShot.impactPoint.y}
                  fill="rgba(255,63,164,0.32)"
                  r="54"
                  stroke="#ff3fa4"
                  strokeWidth="8"
                />
                <circle cx={war.state.lastShot.impactPoint.x} cy={war.state.lastShot.impactPoint.y} fill="#ffffff" r="10" />
              </svg>
            ) : null}

            {war.state.players.map((player) => (
              <div
                className="absolute -translate-x-1/2 -translate-y-full"
                key={player.userId}
                style={{
                  left: percent(player.x, war.level.width),
                  top: percent(player.y, war.level.height)
                }}
              >
                <div
                  className="grid h-10 w-10 place-items-center rounded-full border-2 bg-bc-void text-sm font-black shadow-lg shadow-black/40"
                  style={{
                    borderColor: player.color,
                    color: player.color
                  }}
                  title={player.displayName}
                >
                  {playerInitial(player.displayName)}
                </div>
                <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-black/70">
                  <div className={healthTone(player.health)} style={{ height: "100%", width: `${player.health}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-3">
          <section className="rounded-md border border-bc-line bg-bc-panel p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black uppercase">Players</h2>
              <Badge tone="muted">Turn {war.state.turnNumber}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              {war.state.players.map((player) => (
                <article className="rounded-md border border-bc-line bg-bc-ink p-2" key={player.userId}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{player.displayName}</p>
                      <p className="mt-1 text-xs text-bc-muted">{player.userId === currentUserId ? "You" : "Opponent"}</p>
                    </div>
                    <Badge tone={war.turnUserId === player.userId ? "acid" : "muted"}>{war.turnUserId === player.userId ? "Turn" : "Ready"}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bc-panel">
                      <div className={healthTone(player.health)} style={{ height: "100%", width: `${player.health}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs font-black">{player.health}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-bc-line bg-bc-panel p-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase">Bazooka</h2>
            </div>

            {war.status === "pending" ? (
              <div className="mt-3 grid gap-2">
                <p className="text-sm text-bc-muted">
                  {canAccept ? `${opponent?.displayName ?? "Someone"} is waiting.` : `Waiting for ${opponent?.displayName ?? "the opponent"}.`}
                </p>
                {canAccept ? (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => void postChallengeAction("accept")} size="sm" type="button">
                      Accept
                    </Button>
                    <Button disabled={busy} onClick={() => void postChallengeAction("decline")} size="sm" type="button" variant="ghost">
                      Decline
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {war.status === "active" ? (
              <div className="mt-3 grid gap-3">
                <div className="rounded-md border border-bc-line bg-bc-ink p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-bc-amber" aria-hidden="true" />
                    <span className="font-semibold">{activePlayer ? `${activePlayer.displayName}'s turn` : "Turn changing"}</span>
                  </div>
                </div>
                <label className="grid gap-1 text-xs font-black uppercase text-bc-muted">
                  Angle {Math.round(angle)}
                  <input
                    className="w-full accent-bc-electric"
                    disabled={!canFire}
                    max={90}
                    min={0}
                    onChange={(event) => setAngle(Number(event.target.value))}
                    type="range"
                    value={angle}
                  />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase text-bc-muted">
                  Power {Math.round(power)}
                  <input
                    className="w-full accent-bc-pink"
                    disabled={!canFire}
                    max={100}
                    min={10}
                    onChange={(event) => setPower(Number(event.target.value))}
                    type="range"
                    value={power}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!canFire} onClick={() => void postWarAction("fire", { angle, power })} size="sm" type="button">
                    <Crosshair className="h-4 w-4" aria-hidden="true" />
                    Fire
                  </Button>
                  <Button disabled={busy} onClick={() => void postWarAction("surrender")} size="sm" type="button" variant="ghost">
                    <Flag className="h-4 w-4" aria-hidden="true" />
                    Surrender
                  </Button>
                </div>
              </div>
            ) : null}

            {war.status === "finished" ? (
              <div className="mt-3 rounded-md border border-bc-pink/35 bg-bc-pink/10 p-3">
                <p className="text-sm font-black">{winner ? `${winner.displayName} wins` : "Rave War finished"}</p>
              </div>
            ) : null}

            {error ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-bc-pink/35 bg-bc-pink/10 p-2 text-sm text-bc-pink">
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-bc-line bg-bc-panel p-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-bc-acid" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase">Log</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {war.state.log.map((entry, index) => (
                <p className="rounded-md border border-bc-line bg-bc-ink px-2 py-1.5 text-xs text-bc-muted" key={`${entry}-${index}`}>
                  {entry}
                </p>
              ))}
              {war.state.lastShot ? (
                <p className="rounded-md border border-bc-electric/30 bg-bc-electric/10 px-2 py-1.5 text-xs font-semibold text-bc-electric">
                  Last impact: {war.state.lastShot.impactKind.replace(/-/g, " ")}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
