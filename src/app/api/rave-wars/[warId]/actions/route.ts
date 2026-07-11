import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { fireRaveWarShot, surrenderRaveWar } from "@/lib/rave-wars/rave-war-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    warId: string;
  }>;
};

async function readPayload(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to use Rave Wars." }, { status: 401 });
  }

  const { warId } = await context.params;
  const payload = await readPayload(request);
  const action = typeof payload.action === "string" ? payload.action.trim() : "";

  try {
    if (action === "fire") {
      return NextResponse.json({
        war: await fireRaveWarShot(warId, user.id, {
          angle: payload.angle,
          power: payload.power
        })
      });
    }

    if (action === "surrender") {
      return NextResponse.json({
        war: await surrenderRaveWar(warId, user.id)
      });
    }

    return NextResponse.json({ error: "Choose a valid Rave War action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Rave War action failed."
      },
      { status: 400 }
    );
  }
}
