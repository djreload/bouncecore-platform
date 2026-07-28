import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCoreFpsLobbyForLaunch } from "@/lib/games/core-fps-lobby-service";
import { createCoreFpsLaunch } from "@/lib/games/core-fps-settings-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lobbyId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to launch Core FPS." }, { status: 401 });
  }

  const { lobbyId } = await context.params;

  try {
    const lobby = await getCoreFpsLobbyForLaunch(lobbyId, user.id);
    const launch = await createCoreFpsLaunch(user, lobby);

    return NextResponse.json(
      {
        launch
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
        error: error instanceof Error ? error.message : "Core FPS could not launch."
      },
      {
        status: 400
      }
    );
  }
}
