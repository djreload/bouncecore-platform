import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const uploadsRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
const allowedUploadRoots = new Set([
  "branding-images",
  "chat-emojis",
  "chat-attachments",
  "chat-stickers",
  "core-levels",
  "mobile-apks",
  "music-downloads",
  "music-previews",
  "profile-avatars",
  "product-images",
  "stream-offline-images",
  "throw-sprites",
  "throw-sounds",
  "track-artwork"
]);

function contentTypeForExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".json":
      return "application/json";
    case ".apk":
      return "application/vnd.android.package-archive";
    case ".jpg":
    case ".jpeg":
    case ".jfif":
      return "image/jpeg";
    case ".mp3":
      return "audio/mpeg";
    case ".aac":
      return "audio/aac";
    case ".m4a":
      return "audio/mp4";
    case ".oga":
    case ".ogg":
      return "audio/ogg";
    case ".png":
      return "image/png";
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "audio/webm";
    case ".webp":
      return "image/webp";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function resolveUploadPath(segments: string[]) {
  if (!segments.length || !allowedUploadRoots.has(segments[0])) {
    return null;
  }

  if (segments.some((segment) => !segment || segment === "." || segment === ".." || /[\\/]/.test(segment))) {
    return null;
  }

  const filePath = path.normalize(path.join(uploadsRoot, ...segments));
  const uploadRootWithSeparator = `${uploadsRoot}${path.sep}`;

  if (!filePath.startsWith(uploadRootWithSeparator)) {
    return null;
  }

  return filePath;
}

function parseByteRange(header: string | null, size: number) {
  if (!header) {
    return null;
  }

  const match = header.match(/^bytes=(\d*)-(\d*)$/);

  if (!match || (!match[1] && !match[2])) {
    return "invalid" as const;
  }

  let start: number;
  let end: number;

  if (!match[1]) {
    const suffixLength = Number(match[2]);

    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return "invalid" as const;
    }

    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return "invalid" as const;
  }

  return {
    end: Math.min(end, size - 1),
    start
  };
}

async function uploadResponse(request: Request, context: RouteContext, includeBody: boolean) {
  const { path: segments } = await context.params;
  const filePath = resolveUploadPath(segments);
  const isTemporaryChatAttachment = segments[0] === "chat-attachments";

  if (!filePath) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  let fileStat;

  try {
    fileStat = await stat(/* turbopackIgnore: true */ filePath);
  } catch {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  if (!fileStat.isFile()) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  if (isTemporaryChatAttachment) {
    const uploadPath = `/uploads/${segments.join("/")}`;
    const publicReference = await prisma.chatMessage.findFirst({
      where: {
        deletedAt: null,
        mediaSource: "temporary_chat_attachment",
        OR: [{ mediaUrl: uploadPath }, { mediaPreviewUrl: uploadPath }]
      },
      select: {
        id: true
      }
    });

    if (!publicReference) {
      const user = await getCurrentUser();
      const privateReference = user
        ? await prisma.directMessage.findFirst({
            select: { id: true },
            where: {
              conversation: {
                OR: [{ userOneId: user.id }, { userTwoId: user.id }]
              },
              deletedAt: null,
              mediaSource: "direct_message_attachment",
              OR: [{ mediaUrl: uploadPath }, { mediaPreviewUrl: uploadPath }]
            }
          })
        : null;

      if (!privateReference) {
        return NextResponse.json({ error: "Chat attachment is no longer available." }, { status: 404 });
      }
    }
  }

  const contentType = contentTypeForExtension(path.extname(filePath));
  const forceDownload = isTemporaryChatAttachment && path.extname(filePath).toLowerCase() === ".zip";
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": isTemporaryChatAttachment ? "private, no-store, max-age=0" : "public, max-age=31536000, immutable",
    ...(forceDownload ? { "Content-Disposition": `attachment; filename="${path.basename(filePath)}"` } : {}),
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff"
  };
  const range = parseByteRange(request.headers.get("range"), fileStat.size);

  if (range === "invalid") {
    return new Response(null, {
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes */${fileStat.size}`
      },
      status: 416
    });
  }

  if (range) {
    const length = range.end - range.start + 1;

    return new Response(
      includeBody ? (Readable.toWeb(createReadStream(/* turbopackIgnore: true */ filePath, range)) as ReadableStream<Uint8Array>) : null,
      {
        headers: {
          ...baseHeaders,
          "Content-Length": String(length),
          "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}`
        },
        status: 206
      }
    );
  }

  return new Response(includeBody ? (Readable.toWeb(createReadStream(/* turbopackIgnore: true */ filePath)) as ReadableStream<Uint8Array>) : null, {
    headers: {
      ...baseHeaders,
      "Content-Length": String(fileStat.size)
    }
  });
}

export async function GET(request: Request, context: RouteContext) {
  return uploadResponse(request, context, true);
}

export async function HEAD(request: Request, context: RouteContext) {
  return uploadResponse(request, context, false);
}
