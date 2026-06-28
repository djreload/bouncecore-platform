import { requireInternalTaskAuth } from "@/lib/internal/task-auth";
import { getRestreamTargetUrl } from "@/lib/stream/restream-settings-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function textResponse(body: string, status = 200) {
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8"
    },
    status
  });
}

export async function GET(request: Request) {
  const auth = requireInternalTaskAuth(request);

  if (!auth.ok) {
    return textResponse(auth.error, auth.status);
  }

  const targetUrl = await getRestreamTargetUrl();

  if (!targetUrl) {
    return new Response(null, {
      headers: {
        "Cache-Control": "no-store"
      },
      status: 204
    });
  }

  return textResponse(`${targetUrl}\n`);
}
