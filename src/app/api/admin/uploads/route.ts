import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import type { Permission } from "@/lib/auth/rbac";
import {
  saveOptionalBrandingImageUpload,
  saveOptionalAndroidApkUpload,
  saveOptionalChatAssetUpload,
  saveOptionalDownloadMp3,
  saveOptionalFaviconUpload,
  saveOptionalImageUpload,
  saveOptionalPreviewMp3,
  saveOptionalStreamOfflineImageUpload,
  saveOptionalThrowSpriteUpload
} from "@/lib/media/media-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uploadHandlers = {
  "branding-favicon": {
    permission: "settings.manage",
    save: saveOptionalFaviconUpload
  },
  "branding-logo": {
    permission: "settings.manage",
    save: saveOptionalBrandingImageUpload
  },
  "branding-og-image": {
    permission: "settings.manage",
    save: saveOptionalBrandingImageUpload
  },
  "chat-emoji": {
    permission: "admin.access",
    save: (file) => saveOptionalChatAssetUpload(file, "chat-emojis")
  },
  "chat-sticker": {
    permission: "admin.access",
    save: (file) => saveOptionalChatAssetUpload(file, "chat-stickers")
  },
  "mobile-apk": {
    permission: "mobile.manage",
    save: saveOptionalAndroidApkUpload
  },
  "product-image": {
    permission: "shop.manage",
    save: (file) => saveOptionalImageUpload(file, "product-images")
  },
  "stream-offline-image": {
    permission: "stream.settings.manage",
    save: saveOptionalStreamOfflineImageUpload
  },
  "throw-sprite": {
    permission: "admin.access",
    save: saveOptionalThrowSpriteUpload
  },
  "track-artwork": {
    permission: "music.manage",
    save: (file) => saveOptionalImageUpload(file, "track-artwork")
  },
  "track-download": {
    permission: "music.manage",
    save: saveOptionalDownloadMp3
  },
  "track-preview": {
    permission: "music.manage",
    save: saveOptionalPreviewMp3
  }
} as const satisfies Record<
  string,
  {
    permission: Permission;
    save: (file: File | null | undefined) => Promise<string | null>;
  }
>;

type UploadKind = keyof typeof uploadHandlers;

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function uploadKind(value: FormDataEntryValue | null): UploadKind | null {
  if (typeof value !== "string") {
    return null;
  }

  return value in uploadHandlers ? (value as UploadKind) : null;
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
  try {
    const formData = await request.formData();
    const kind = uploadKind(formData.get("kind"));
    const file = formFile(formData, "file");

    if (!kind) {
      return NextResponse.json({ error: "Unsupported admin upload type." }, { status: 400 });
    }

    const handler = uploadHandlers[kind];
    const user = await getApiUserWithPermission(handler.permission);

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!file || !file.size) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    const url = await handler.save(file);

    if (!url) {
      return NextResponse.json({ error: "Upload did not produce a file path." }, { status: 400 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: uploadErrorMessage(error) }, { status: 400 });
  }
}
