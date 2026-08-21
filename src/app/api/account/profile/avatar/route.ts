import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { saveOptionalProfileAvatarUpload } from "@/lib/media/media-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const maxCroppedAvatarRequestBytes = 5 * 1024 * 1024;

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function uploadErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code);

    if (["EACCES", "ENOENT", "EROFS"].includes(code)) {
      return "The server could not save the profile picture. Check the uploads volume permissions.";
    }
  }

  return error instanceof Error ? error.message : "Profile picture upload failed.";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to upload a profile picture." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > maxCroppedAvatarRequestBytes) {
    return NextResponse.json({ error: "The prepared profile picture is too large." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formFile(formData, "file");

    if (!file?.size) {
      return NextResponse.json({ error: "Choose a profile picture to upload." }, { status: 400 });
    }

    if (file.size > maxCroppedAvatarRequestBytes) {
      return NextResponse.json({ error: "The prepared profile picture is too large." }, { status: 413 });
    }

    const url = await saveOptionalProfileAvatarUpload(file);

    if (!url) {
      return NextResponse.json({ error: "Profile picture upload did not produce a file path." }, { status: 400 });
    }

    return NextResponse.json(
      { url },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: uploadErrorMessage(error) },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }
}
