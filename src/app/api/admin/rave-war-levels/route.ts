import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { createRaveWarLevel } from "@/lib/rave-wars/rave-war-level-service";
import {
  saveOptionalRaveWarBackgroundUpload,
  saveRaveWarTerrainUpload
} from "@/lib/rave-wars/rave-war-terrain-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function uploadErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code);

    if (["EACCES", "ENOENT", "EROFS"].includes(code)) {
      return "The server could not write the level images. Check the uploads volume permissions.";
    }
  }

  return error instanceof Error ? error.message : "Rave War level upload failed.";
}

function revalidateLevelViews() {
  revalidatePath("/admin/rave-war-levels");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/live");
  revalidatePath("/chat");
}

export async function POST(request: Request) {
  const actor = await getApiUserWithPermission("settings.manage");

  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const terrainFile = formFile(formData, "terrainFile");
    const name = formString(formData, "name");
    const theme = formString(formData, "theme");

    if (!terrainFile?.size) {
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

    return NextResponse.json({
      message: `${level.name} uploaded with generated collision terrain and spawn points.`
    });
  } catch (error) {
    console.error("[rave-war-levels] Upload failed.", error);
    return NextResponse.json({ error: uploadErrorMessage(error) }, { status: 400 });
  }
}
