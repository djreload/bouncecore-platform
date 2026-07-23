import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCoreFpsLobbyState } from "@/lib/games/core-fps-lobby-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lobbyId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to view the Core FPS lobby." }, { status: 401 });
  }

  const { lobbyId } = await context.params;

  try {
    const lobby = await getCoreFpsLobbyState(lobbyId, user.id);

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
        error: error instanceof Error ? error.message : "The Core FPS lobby could not be loaded."
      },
      {
        status: 400
      }
    );
  }
}
