import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { liveStatusSignature, publicLiveStateToStatusPayload, type LiveStatusEventPayload } from "@/lib/stream/live-status-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();
const liveStatusPollMs = 1000;
const liveStatusHeartbeatMs = 10000;

function encodeServerEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function encodeServerComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

async function readLiveStatusPayload(): Promise<LiveStatusEventPayload> {
  return publicLiveStateToStatusPayload(await getPublicLiveState());
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

export async function GET(request: Request) {
  const initialPayload = await readLiveStatusPayload();
  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      let lastSignature = liveStatusSignature(initialPayload);
      let lastHeartbeatAt = Date.now();

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

      enqueue(encodeServerEvent("status", initialPayload));

      async function pumpStatus() {
        while (!cancelled && !request.signal.aborted) {
          const reason = await waitForNextPoll(request.signal, liveStatusPollMs);

          if (reason === "abort" || cancelled || request.signal.aborted) {
            break;
          }

          try {
            const payload = await readLiveStatusPayload();
            const nextSignature = liveStatusSignature(payload);

            if (nextSignature !== lastSignature) {
              if (!enqueue(encodeServerEvent("status", payload))) {
                break;
              }

              lastSignature = nextSignature;
              lastHeartbeatAt = Date.now();
              continue;
            }

            if (Date.now() - lastHeartbeatAt >= liveStatusHeartbeatMs) {
              if (!enqueue(encodeServerComment("keep-alive"))) {
                break;
              }

              lastHeartbeatAt = Date.now();
            }
          } catch {
            enqueue(encodeServerEvent("error", { error: "Live status stream closed." }));
            break;
          }
        }

        try {
          controller.close();
        } catch {
          // The browser can close the SSE connection between polls.
        }
      }

      void pumpStatus();
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
