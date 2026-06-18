import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const uploadsRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
const allowedUploadRoots = new Set([
  "chat-emojis",
  "chat-stickers",
  "music-downloads",
  "music-previews",
  "profile-avatars",
  "product-images",
  "stream-offline-images",
  "track-artwork"
]);

function contentTypeForExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
    case ".jfif":
      return "image/jpeg";
    case ".mp3":
      return "audio/mpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
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

  const contentType = contentTypeForExtension(path.extname(filePath));
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": contentType
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
