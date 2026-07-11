import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRaveWarForUser } from "@/lib/rave-wars/rave-war-service";
import { subscribeToRaveWarChanges } from "@/lib/rave-wars/rave-war-realtime";
import type { RaveWarSummary } from "@/lib/rave-wars/rave-war-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    warId: string;
  }>;
};

const raveWarStreamPollMs = 2500;
const raveWarStreamConsistencyPollMs = 30000;
const raveWarStreamHeartbeatMs = 15000;
const encoder = new TextEncoder();

function encodeServerEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function encodeServerComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

function warSignature(war: RaveWarSummary) {
  return JSON.stringify({
    endedAt: war.endedAt,
    craters: war.state.craters,
    lastShot: war.state.lastShot,
    log: war.state.log,
    players: war.state.players.map(
      (player) =>
        `${player.userId}:${player.health}:${player.angle}:${player.power}:${player.x}:${player.y}:${player.facing}:${player.movementLeft}:${player.selectedWeapon}`
    ),
    status: war.status,
    turnEndsAt: war.state.turnEndsAt,
    turnNumber: war.state.turnNumber,
    turnStartedAt: war.state.turnStartedAt,
    turnUserId: war.turnUserId,
    winnerUserId: war.winnerUserId
  });
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
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to view this Rave War." }, { status: 401 });
  }

  const currentUserId = user.id;
  const { warId } = await context.params;
  let initialWar: RaveWarSummary;

  try {
    initialWar = await getRaveWarForUser(warId, currentUserId);
  } catch {
    return NextResponse.json({ error: "Rave War not found." }, { status: 404 });
  }

  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      let lastSignature = warSignature(initialWar);
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

      enqueue(encodeServerEvent("war", { war: initialWar }));

      async function pumpWar() {
        const unsubscribe = await subscribeToRaveWarChanges(warId, refreshSignal.notify).catch(() => null);
        const refreshIntervalMs = unsubscribe
          ? Math.min(raveWarStreamConsistencyPollMs, raveWarStreamHeartbeatMs)
          : raveWarStreamPollMs;

        while (!cancelled && !request.signal.aborted) {
          const reason = unsubscribe
            ? await refreshSignal.wait(refreshIntervalMs)
            : await waitForNextPoll(request.signal, refreshIntervalMs);

          if (reason === "abort" || cancelled || request.signal.aborted) {
            break;
          }

          try {
            const war = await getRaveWarForUser(warId, currentUserId);
            const nextSignature = warSignature(war);

            if (nextSignature !== lastSignature) {
              if (!enqueue(encodeServerEvent("war", { war }))) {
                break;
              }

              lastSignature = nextSignature;
              lastHeartbeatAt = Date.now();
              continue;
            }

            if (Date.now() - lastHeartbeatAt >= raveWarStreamHeartbeatMs) {
              if (!enqueue(encodeServerComment("keep-alive"))) {
                break;
              }

              lastHeartbeatAt = Date.now();
            }
          } catch {
            enqueue(encodeServerEvent("error", { error: "Rave War stream closed." }));
            break;
          }
        }

        await unsubscribe?.().catch(() => {
          // Closing the browser can race with Redis unsubscribe cleanup.
        });

        try {
          controller.close();
        } catch {
          // The browser can close the stream between polls.
        }
      }

      void pumpWar();
    },
    cancel() {
      cancelled = true;
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
