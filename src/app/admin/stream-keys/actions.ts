"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createStreamKeyForUser,
  revokeStreamKeyById,
  rotateStreamKeyForUser
} from "@/lib/stream/stream-key-service";
import type { AdminStreamKeyActionState } from "@/app/admin/stream-keys/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function responseWithRawKey(
  message: string,
  result: Awaited<ReturnType<typeof createStreamKeyForUser>>
): AdminStreamKeyActionState {
  return {
    status: "success",
    message,
    rawKey: result.rawKey,
    fingerprint: result.key?.fingerprint
  };
}

export async function adminStreamKeyAction(
  _previousState: AdminStreamKeyActionState,
  formData: FormData
): Promise<AdminStreamKeyActionState> {
  const intent = formString(formData, "intent");
  const targetUserId = formString(formData, "userId");
  const keyId = formString(formData, "keyId");
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "stream.keys.manage.any")) {
    return {
      status: "error",
      message: "You do not have permission to manage stream keys."
    };
  }

  const canRevealRawKeys = hasPermission(actor, "stream.keys.view.raw.any");

  try {
    if (intent === "create") {
      if (!canRevealRawKeys) {
        return {
          status: "error",
          message: "Creating stream keys requires raw-key reveal permission so the new private key is not lost."
        };
      }

      if (!targetUserId) {
        return {
          status: "error",
          message: "Choose a user before creating a stream key."
        };
      }

      const result = await createStreamKeyForUser(targetUserId, {
        action: "stream.key.admin_create",
        actorId: actor.id,
        metadata: {
          source: "admin"
        }
      });

      revalidatePath("/admin/stream-keys");
      revalidatePath("/admin/audit-logs");

      if (!result.rawKey) {
        return {
          status: "error",
          message: "That user already has an active stream key. Rotate it if you need a replacement.",
          fingerprint: result.key?.fingerprint
        };
      }

      return responseWithRawKey("Stream key created. Copy it now; only the hash is stored.", result);
    }

    if (intent === "rotate") {
      if (!canRevealRawKeys) {
        return {
          status: "error",
          message: "Rotating stream keys requires raw-key reveal permission so the replacement key is not lost."
        };
      }

      if (!targetUserId) {
        return {
          status: "error",
          message: "Missing stream-key user."
        };
      }

      const result = await rotateStreamKeyForUser(targetUserId, {
        action: "stream.key.admin_rotate",
        actorId: actor.id,
        metadata: {
          source: "admin"
        }
      });

      revalidatePath("/admin/stream-keys");
      revalidatePath("/admin/audit-logs");

      return responseWithRawKey("Stream key rotated. Copy the replacement before leaving this page.", result);
    }

    if (intent === "revoke") {
      if (!keyId) {
        return {
          status: "error",
          message: "Missing stream key."
        };
      }

      await revokeStreamKeyById(keyId, {
        action: "stream.key.admin_revoke",
        actorId: actor.id,
        metadata: {
          source: "admin"
        }
      });

      revalidatePath("/admin/stream-keys");
      revalidatePath("/admin/audit-logs");

      return {
        status: "success",
        message: "Stream key revoked."
      };
    }

    return {
      status: "error",
      message: "Unknown stream-key action."
    };
  } catch {
    return {
      status: "error",
      message: "Stream-key action failed. Check the audit log or try again."
    };
  }
}
