import { PublicModulePlaceholder } from "@/components/ui/module-placeholder";

export default function DjsPage() {
  return (
    <PublicModulePlaceholder
      title="DJs"
      eyebrow="Streamer profiles"
      description="Public DJ and streamer profiles will show schedule, live state, verification, and profile content without exposing private stream keys."
      items={["DJ cards", "Schedules", "Verified profiles"]}
    />
  );
}
