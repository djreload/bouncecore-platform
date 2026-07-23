"use server";

import { revalidatePath } from "next/cache";
import type { AdminCoreFpsActionState } from "@/app/admin/core-fps/state";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { updateCoreFpsSettings } from "@/lib/games/core-fps-settings-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function adminCoreFpsAction(
  _previousState: AdminCoreFpsActionState,
  formData: FormData
): Promise<AdminCoreFpsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "settings.manage")) {
    return {
      message: "You do not have permission to manage Core FPS.",
      status: "error"
    };
  }

  try {
    await updateCoreFpsSettings(
      {
        enabled: formData.get("enabled") === "on",
        lobbyWaitSeconds: formString(formData, "lobbyWaitSeconds"),
        mapPool: formData.getAll("mapPool").filter((value): value is string => typeof value === "string"),
        publicUrl: formString(formData, "publicUrl")
      },
      actor.id
    );

    revalidatePath("/admin/core-fps");
    revalidatePath("/admin/audit-logs");
    revalidatePath("/games/core");

    return {
      message: "Core FPS launcher settings saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Core FPS settings could not be saved.",
      status: "error"
    };
  }
}
