"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/auth/audit";
import { requireSignedInUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import { syncStreamProviderSnapshot, type StreamSessionSyncResult } from "@/lib/stream/stream-session-sync-service";
import type { AdminStreamSessionsActionState } from "@/app/admin/stream-sessions/state";

function revalidateStreamSessionViews() {
  revalidatePath("/admin/stream");
  revalidatePath("/admin/stream-sessions");
  revalidatePath("/admin/system-health");
  revalidatePath("/live");
  revalidatePath("/internal/stream/status");
  revalidatePath("/overlay/stars");
  revalidatePath("/streamer/health");
  revalidatePath("/streamer/status");
}

function syncMessage(result: StreamSessionSyncResult) {
  const viewerText = `${result.viewerCount.toLocaleString("en-GB")} viewer${result.viewerCount === 1 ? "" : "s"}`;

  if (result.sessionStarted) {
    return `Provider sync opened a live session with ${viewerText}.`;
  }

  if (result.sessionsClosed > 0) {
    return `Provider sync closed ${result.sessionsClosed.toLocaleString("en-GB")} open session${result.sessionsClosed === 1 ? "" : "s"}.`;
  }

  if (result.eventTypes.length > 0) {
    return `Provider sync recorded ${result.eventTypes.length.toLocaleString("en-GB")} stream event${result.eventTypes.length === 1 ? "" : "s"}.`;
  }

  return `Provider state refreshed: ${result.status} with ${viewerText}.`;
}

export async function syncStreamSessionsAction(
  _previousState: AdminStreamSessionsActionState,
  _formData: FormData
): Promise<AdminStreamSessionsActionState> {
  void _previousState;
  void _formData;

  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "stream.settings.manage")) {
    return {
      status: "error",
      message: "You do not have permission to sync stream provider state."
    };
  }

  try {
    const result = await syncStreamProviderSnapshot();

    await writeAuditLog({
      action: "stream.provider.manual_sync",
      actorId: actor.id,
      metadata: result as unknown as Prisma.InputJsonValue,
      target: `stream-channel:${result.channelId}`
    });

    revalidateStreamSessionViews();

    return {
      status: "success",
      message: syncMessage(result)
    };
  } catch {
    return {
      status: "error",
      message: "Stream provider sync failed. Check system health and stream-core logs."
    };
  }
}
