"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createOwnStreamKey,
  revokeOwnStreamKey,
  rotateOwnStreamKey
} from "@/lib/stream/stream-key-service";
import type { StreamKeyActionState } from "@/app/streamer/stream-key/state";

export async function streamKeyAction(
  _previousState: StreamKeyActionState,
  formData: FormData
): Promise<StreamKeyActionState> {
  const intent = formData.get("intent");
  const user = await requireSignedInUser();

  if (!hasPermission(user, "stream.keys.manage.own")) {
    return {
      status: "error",
      message: "You do not have permission to manage stream keys."
    };
  }

  try {
    if (intent === "create") {
      const result = await createOwnStreamKey(user.id, user.id);
      revalidatePath("/streamer/stream-key");

      return result.rawKey
        ? {
            status: "success",
            message: "Stream key created. Copy it now; Bouncecore stores only the hash.",
            rawKey: result.rawKey,
            key: result.key
          }
        : {
            status: "error",
            message: "An active stream key already exists. Rotate it if you need a new one.",
            key: result.key
          };
    }

    if (intent === "rotate") {
      const result = await rotateOwnStreamKey(user.id, user.id);
      revalidatePath("/streamer/stream-key");

      return {
        status: "success",
        message: "Stream key rotated. Update OBS with the new key before going live.",
        rawKey: result.rawKey,
        key: result.key
      };
    }

    if (intent === "revoke") {
      await revokeOwnStreamKey(user.id, user.id);
      revalidatePath("/streamer/stream-key");

      return {
        status: "success",
        message: "Active stream key revoked. Create a new one before your next broadcast.",
        key: null
      };
    }

    return {
      status: "error",
      message: "Unknown stream-key action."
    };
  } catch {
    return {
      status: "error",
      message: "Stream-key action failed. Try again or check the audit log."
    };
  }
}
