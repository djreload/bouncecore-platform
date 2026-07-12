import { notFound } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { RaveWarGame } from "@/app/rave-wars/[warId]/rave-war-game";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getRaveWarForUser } from "@/lib/rave-wars/rave-war-service";

export const dynamic = "force-dynamic";

type RaveWarPageProps = {
  params: Promise<{
    warId: string;
  }>;
};

async function findRaveWarForUser(warId: string, userId: string) {
  try {
    return await getRaveWarForUser(warId, userId);
  } catch {
    return null;
  }
}

export default async function RaveWarPage({ params }: RaveWarPageProps) {
  const user = await requireSignedInUser();
  const { warId } = await params;
  const war = await findRaveWarForUser(warId, user.id);

  if (!war) {
    notFound();
  }

  return (
    <PublicShell hideFooterOnMobile>
      <main className="h-dvh overflow-hidden bg-bc-void p-0 lg:min-h-[calc(100dvh-65px)] lg:overflow-visible lg:px-5 lg:py-4">
        <RaveWarGame currentUserId={user.id} initialWar={war} />
      </main>
    </PublicShell>
  );
}
