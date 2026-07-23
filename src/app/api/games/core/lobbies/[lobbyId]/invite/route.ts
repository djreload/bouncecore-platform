import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { sendCoreFpsLobbyInvites } from "@/lib/games/core-fps-invite-service";

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
    return NextResponse.json({ error: "Sign in to invite players." }, { status: 401 });
  }

  const { lobbyId } = await context.params;
  let targetUserId: string | null = null;

  try {
    const payload = (await request.json()) as {
      targetUserId?: unknown;
    };

    if (typeof payload.targetUserId === "string" && payload.targetUserId.trim()) {
      targetUserId = payload.targetUserId.trim();
    }
  } catch {
    targetUserId = null;
  }

  try {
    const result = await sendCoreFpsLobbyInvites({
      actorId: user.id,
      lobbyId,
      postChatMessage: !targetUserId,
      targetUserId
    });

    return NextResponse.json(
      {
        invitedUserCount: result.invitedUserCount,
        repeatedUserCount: result.repeatedUserCount
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
        error: error instanceof Error ? error.message : "Players could not be invited."
      },
      {
        status: 400
      }
    );
  }
}
