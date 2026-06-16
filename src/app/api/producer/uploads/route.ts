import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { saveOptionalDownloadMp3, saveOptionalImageUpload, saveOptionalPreviewMp3 } from "@/lib/media/media-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function uploadErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code);

    if (["EACCES", "ENOENT", "EROFS"].includes(code)) {
      return "The server could not write the upload file. Check the uploads volume permissions.";
    }
  }

  return error instanceof Error ? error.message : "Upload failed.";
}

export async function POST(request: Request) {
  const user = await getApiUserWithPermission("producer.dashboard");

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const kind = formData.get("kind");
    const file = formFile(formData, "file");

    if (!file || !file.size) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    let url: string | null = null;

    if (kind === "artwork") {
      url = await saveOptionalImageUpload(file, "track-artwork");
    } else if (kind === "preview") {
      url = await saveOptionalPreviewMp3(file);
    } else if (kind === "download") {
      url = await saveOptionalDownloadMp3(file);
    } else {
      return NextResponse.json({ error: "Unsupported producer upload type." }, { status: 400 });
    }

    if (!url) {
      return NextResponse.json({ error: "Upload did not produce a file path." }, { status: 400 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: uploadErrorMessage(error) }, { status: 400 });
  }
}
