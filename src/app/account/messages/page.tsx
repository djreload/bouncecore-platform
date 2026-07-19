import { DirectMessagesPanel } from "@/app/account/messages/direct-messages-panel";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getDirectMessagingData } from "@/lib/messages/direct-message-service";

export const dynamic = "force-dynamic";

type AccountMessagesPageProps = {
  searchParams?: Promise<{
    conversation?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountMessagesPage({ searchParams }: AccountMessagesPageProps) {
  const user = await requireSignedInUser();
  const params = searchParams ? await searchParams : {};
  const data = await getDirectMessagingData(user.id, firstParam(params.conversation));

  return (
    <DashboardShell title="Private messages" description="One-to-one conversations, unread messages, and participant-only file sharing.">
      <DirectMessagesPanel currentUserId={user.id} initialData={data} />
    </DashboardShell>
  );
}
