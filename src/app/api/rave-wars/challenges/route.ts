import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  acceptRaveWarChallenge,
  cancelRaveWarChallenge,
  createRaveWarChallenge,
  declineRaveWarChallenge,
  getPendingRaveWarChallenges
} from "@/lib/rave-wars/rave-war-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readPayload(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, challenges: [] });
  }

  try {
    return NextResponse.json({
      authenticated: true,
      challenges: await getPendingRaveWarChallenges(user.id)
    });
  } catch {
    return NextResponse.json({ error: "Rave War challenges are not available right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to use Rave Wars." }, { status: 401 });
  }

  const payload = await readPayload(request);
  const action = payloadString(payload, "action");
  const warId = payloadString(payload, "warId");

  try {
    if (action === "create") {
      const war = await createRaveWarChallenge(payloadString(payload, "roomId"), user.id, payloadString(payload, "targetUserId"));

      return NextResponse.json({ war });
    }

    if (action === "accept") {
      return NextResponse.json({
        war: await acceptRaveWarChallenge(warId, user.id)
      });
    }

    if (action === "decline") {
      return NextResponse.json({
        war: await declineRaveWarChallenge(warId, user.id)
      });
    }

    if (action === "cancel") {
      return NextResponse.json({
        war: await cancelRaveWarChallenge(warId, user.id)
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
