import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/games/core-fps-core";
import { recordCoreFpsTelemetry, type CoreFpsTelemetryInput } from "@/lib/games/core-fps-score-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      error: message
    },
    {
      headers: {
        "Cache-Control": "no-store"
      },
      status
    }
  );
}

export async function POST(request: Request) {
  const expectedSecret = process.env.CORE_FPS_TELEMETRY_SECRET?.trim() ?? "";
  const providedSecret = request.headers.get("x-core-telemetry-secret")?.trim() ?? "";

  if (expectedSecret.length < 32) {
    return errorResponse("Core FPS telemetry is not configured.", 503);
  }

  if (!secretsMatch(providedSecret, expectedSecret)) {
    return errorResponse("Core FPS telemetry authentication failed.", 403);
  }

  try {
    const payload = (await request.json()) as CoreFpsTelemetryInput;
    const session = await recordCoreFpsTelemetry(payload);

    return NextResponse.json(
      {
        accepted: true,
        score: session.score,
        sessionId: session.id
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Core FPS telemetry was rejected.", 400);
  }
}
