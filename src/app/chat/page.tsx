import { PublicModulePlaceholder } from "@/components/ui/module-placeholder";

export default function ChatPage() {
  return (
    <PublicModulePlaceholder
      title="Bouncecore Chat"
      eyebrow="Native chatrooms"
      description="Public, private, DJ, producer, VIP, and moderation-ready rooms will be built as Bouncecore-owned realtime chat, not Owncast chat."
      items={["Public rooms", "Live chat", "Moderation tools"]}
    />
  );
}
