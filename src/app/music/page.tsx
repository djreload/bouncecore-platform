import { PublicModulePlaceholder } from "@/components/ui/module-placeholder";

export default function MusicPage() {
  return (
    <PublicModulePlaceholder
      title="Bouncecore Music"
      eyebrow="Marketplace"
      description="The marketplace shell is reserved for track previews, licenses, digital purchases, producer approvals, and protected downloads."
      items={["Track cards", "License options", "Download library"]}
    />
  );
}
