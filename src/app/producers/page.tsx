import { PublicModulePlaceholder } from "@/components/ui/module-placeholder";

export default function ProducersPage() {
  return (
    <PublicModulePlaceholder
      title="Producers"
      eyebrow="Producer profiles"
      description="Producer profiles will connect artists to approved tracks, releases, sales, downloads, and marketplace analytics."
      items={["Producer cards", "Release pages", "Sales signals"]}
    />
  );
}
