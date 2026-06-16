import { NextResponse } from "next/server";
import { ingestPayPalWebhook } from "@/lib/payments/paypal-webhook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function webhookErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("payload is too large")) {
    return 413;
  }

  if (message.includes("webhook ID is not configured")) {
    return 503;
  }

  if (
    message.includes("signature") ||
    message.includes("certificate") ||
    message.includes("event ID is missing") ||
    error instanceof SyntaxError
  ) {
    return 400;
  }

  return 500;
}

export async function POST(request: Request) {
  try {
    const result = await ingestPayPalWebhook(request);

    return NextResponse.json({
      ok: true,
      processingStatus: result.processingStatus
    });
  } catch (error) {
    const status = webhookErrorStatus(error);

    return NextResponse.json(
      {
        error: status === 500 ? "PayPal webhook could not be processed." : error instanceof Error ? error.message : "Invalid PayPal webhook."
      },
      {
        status
      }
    );
  }
}
