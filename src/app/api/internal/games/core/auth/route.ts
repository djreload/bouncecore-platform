import { NextResponse } from "next/server";
import { secretsMatch, verifyCoreFpsTicket } from "@/lib/games/core-fps-core";

export const dynamic = "force-dynamic";

function unauthorized(message: string, status = 401) {
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

export async function GET(request: Request) {
  const expectedGatewaySecret = process.env.CORE_FPS_GATEWAY_SHARED_SECRET?.trim() ?? "";
  const providedGatewaySecret = request.headers.get("x-core-gateway-secret")?.trim() ?? "";

  if (expectedGatewaySecret.length < 32) {
    return unauthorized("Core FPS gateway authentication is not configured.", 503);
  }

  if (!secretsMatch(providedGatewaySecret, expectedGatewaySecret)) {
    return unauthorized("Core FPS gateway authentication failed.", 403);
  }

  const ticket = request.headers.get("x-core-ticket")?.trim() ?? "";
  const ticketSecret = process.env.CORE_FPS_TICKET_SECRET?.trim() ?? "";

  try {
    const claims = verifyCoreFpsTicket(ticket, ticketSecret);

    return new NextResponse(null, {
      headers: {
        "Cache-Control": "no-store",
        "X-Core-Display-Name": encodeURIComponent(claims.name),
        "X-Core-Player-Name": claims.player,
        "X-Core-Session-Id": claims.sid,
        "X-Core-User-Id": claims.sub
      },
      status: 204
    });
  } catch (error) {
    return unauthorized(error instanceof Error ? error.message : "Core FPS ticket was rejected.");
  }
}
