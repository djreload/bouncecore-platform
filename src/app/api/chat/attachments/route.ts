import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { createTemporaryChatAttachmentMessage } from "@/lib/chat/chat-service";

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
      return "The server could not write the temporary chat attachment. Check the uploads volume permissions.";
    }
  }

  return error instanceof Error ? error.message : "Chat attachment could not be sent.";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to send chat attachments." }, { status: 401 });
  }

  if (!hasPermission(user, "moderation.use")) {
    return NextResponse.json({ error: "Only moderators and admins can send chat attachments." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const roomId = formString(formData, "roomId");
    const file = formFile(formData, "file");

    if (!roomId) {
      return NextResponse.json({ error: "Choose a chat room before attaching a file." }, { status: 400 });
    }

    if (!file || !file.size) {
      return NextResponse.json({ error: "Choose an image or ZIP file to attach." }, { status: 400 });
    }

    const message = await createTemporaryChatAttachmentMessage(roomId, user.id, file);

    return NextResponse.json(
      {
        id: message.id,
        kind: message.kind,
        message: "Attachment sent.",
        revision: Date.now(),
        status: "success"
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: uploadErrorMessage(error),
        status: "error"
      },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }
}
