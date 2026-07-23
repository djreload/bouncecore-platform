import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recordCoreFpsPresence } from "@/lib/games/core-fps-score-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to update game presence." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  let active = true;

  try {
    const payload = (await request.json()) as {
      active?: unknown;
    };
    active = payload.active !== false;
  } catch {
    active = false;
  }

  try {
    await recordCoreFpsPresence(sessionId, user.id, active);

    return NextResponse.json(
      {
        active
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Game presence could not be updated."
      },
      {
        status: 400
      }
    );
  }
}
