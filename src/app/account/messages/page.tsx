import { DirectMessagesPanel } from "@/app/account/messages/direct-messages-panel";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getDirectMessagingData, startDirectConversation } from "@/lib/messages/direct-message-service";

export const dynamic = "force-dynamic";

type AccountMessagesPageProps = {
  searchParams?: Promise<{
    conversation?: string | string[];
    user?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountMessagesPage({ searchParams }: AccountMessagesPageProps) {
  const user = await requireSignedInUser();
  const params = searchParams ? await searchParams : {};
  let conversationId = firstParam(params.conversation);
  let initialError: string | null = null;
  const targetUserId = firstParam(params.user);

  if (targetUserId && targetUserId !== user.id) {
    try {
      const conversation = await startDirectConversation(user.id, targetUserId);
      conversationId = conversation.id;
    } catch (error) {
      initialError = error instanceof Error ? error.message : "That private conversation could not be opened.";
    }
  }

  const data = await getDirectMessagingData(user.id, conversationId);

  return (
    <DashboardShell title="Private messages" description="One-to-one conversations, unread messages, and participant-only file sharing.">
      <DirectMessagesPanel currentUserId={user.id} initialData={data} initialError={initialError} />
    </DashboardShell>
  );
}
