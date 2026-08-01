import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import {
  deleteCoreLevelProject,
  getAdminCoreLevelBuilderData,
  publishCoreLevelProject,
  saveCoreLevelProject
} from "@/lib/games/core-level-builder-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "The Core level request failed."
    },
    {
      status: 400
    }
  );
}

export async function GET(request: Request) {
  const user = await getApiUserWithPermission("settings.manage");
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const projectId = new URL(request.url).searchParams.get("project");
  return NextResponse.json(await getAdminCoreLevelBuilderData(projectId));
}

export async function POST(request: Request) {
  const user = await getApiUserWithPermission("settings.manage");
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "save") {
      return NextResponse.json(
        await saveCoreLevelProject(
          {
            description: body.description,
            document: body.document,
            name: body.name,
            projectId: body.projectId
          },
          user.id
        )
      );
    }

    if (action === "publish") {
      return NextResponse.json(
        await publishCoreLevelProject(
          {
            document: body.document,
            previewDataUrl: body.previewDataUrl,
            projectId: body.projectId
          },
          user.id
        )
      );
    }

    if (action === "delete") {
      return NextResponse.json({
        deleted: await deleteCoreLevelProject(body.projectId, user.id)
      });
    }

    return NextResponse.json({ error: "Unsupported Core level action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
