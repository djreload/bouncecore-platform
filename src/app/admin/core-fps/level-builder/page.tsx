import type { Metadata } from "next";
import { CoreLevelBuilder } from "@/app/admin/core-fps/level-builder/core-level-builder";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminCoreLevelBuilderData } from "@/lib/games/core-level-builder-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Core Level Builder | Bouncecore"
};

type CoreLevelBuilderPageProps = {
  searchParams: Promise<{
    project?: string;
  }>;
};

export default async function CoreLevelBuilderPage({
  searchParams
}: CoreLevelBuilderPageProps) {
  await requireUserPermission("settings.manage");
  const { project } = await searchParams;
  const data = await getAdminCoreLevelBuilderData(project);

  return <CoreLevelBuilder initialData={data} />;
}
