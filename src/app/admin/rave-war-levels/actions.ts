"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createRaveWarLevel,
  deleteRaveWarLevel,
  setActiveRaveWarLevel,
  updateRaveWarLevelSpawns
} from "@/lib/rave-wars/rave-war-level-service";
import {
  saveOptionalRaveWarBackgroundUpload,
  saveRaveWarTerrainUpload
} from "@/lib/rave-wars/rave-war-terrain-upload";
import type { AdminRaveWarLevelsActionState } from "@/app/admin/rave-war-levels/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function revalidateLevelViews() {
  revalidatePath("/admin/rave-war-levels");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/live");
  revalidatePath("/chat");
}

export async function adminRaveWarLevelsAction(
  _previousState: AdminRaveWarLevelsActionState,
  formData: FormData
): Promise<AdminRaveWarLevelsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "settings.manage")) {
    return {
      message: "You do not have permission to manage Rave War levels.",
      status: "error"
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "create") {
      const terrainFile = formFile(formData, "terrainFile");
      const name = formString(formData, "name").trim();
      const theme = formString(formData, "theme").trim();

      if (!terrainFile) {
        throw new Error("Choose a transparent terrain PNG.");
      }

      if (name.length < 2 || name.length > 60) {
        throw new Error("Level name must be between 2 and 60 characters.");
      }

      if (theme.length < 2 || theme.length > 40) {
        throw new Error("Theme must be between 2 and 40 characters.");
      }

      const [terrain, backgroundImageUrl] = await Promise.all([
        saveRaveWarTerrainUpload(terrainFile),
        saveOptionalRaveWarBackgroundUpload(formFile(formData, "backgroundFile"))
      ]);
      const level = await createRaveWarLevel(
        {
          ...terrain,
          backgroundColor: formString(formData, "backgroundColor"),
          backgroundImageUrl,
          makeActive: formString(formData, "makeActive") === "true",
          name,
          theme
        },
        actor.id
      );
      revalidateLevelViews();

      return {
        message: `${level.name} uploaded with generated collision terrain and spawn points.`,
        status: "success"
      };
    }

    if (intent === "activate") {
      await setActiveRaveWarLevel(formString(formData, "levelKey"), actor.id);
      revalidateLevelViews();

      return {
        message: "Active Rave War level updated. New challenges will use it.",
        status: "success"
      };
    }

    if (intent === "spawns") {
      await updateRaveWarLevelSpawns(
        formString(formData, "levelKey"),
        Number(formString(formData, "firstSpawnX")),
        Number(formString(formData, "secondSpawnX")),
        actor.id
      );
      revalidateLevelViews();

      return {
        message: "Level spawn positions updated.",
        status: "success"
      };
    }

    if (intent === "delete") {
      if (formString(formData, "confirmation") !== "DELETE LEVEL") {
        throw new Error("Level deletion confirmation is missing.");
      }

      await deleteRaveWarLevel(formString(formData, "levelKey"), actor.id);
      revalidateLevelViews();

      return {
        message: "Unused custom level and its managed images were deleted.",
        status: "success"
      };
    }

    return {
      message: "Unknown Rave War level action.",
      status: "error"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Rave War level action failed.",
      status: "error"
    };
  }
}
