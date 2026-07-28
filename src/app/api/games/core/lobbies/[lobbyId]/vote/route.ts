import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { castCoreFpsLobbyVote } from "@/lib/games/core-fps-lobby-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lobbyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to vote in the Core FPS lobby." }, { status: 401 });
  }

  const { lobbyId } = await context.params;

  try {
    const input = (await request.json()) as {
      mapName?: unknown;
      modeName?: unknown;
    };
    const lobby = await castCoreFpsLobbyVote(lobbyId, user.id, input);

    return NextResponse.json(
      {
        lobby
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
        error: error instanceof Error ? error.message : "Your lobby vote could not be saved."
      },
      {
        status: 400
      }
    );
  }
}
