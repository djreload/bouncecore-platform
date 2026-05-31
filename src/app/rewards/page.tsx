import { PublicModulePlaceholder } from "@/components/ui/module-placeholder";

export default function RewardsPage() {
  return (
    <PublicModulePlaceholder
      title="Rewards"
      eyebrow="Supporter perks"
      description="Rewards will cover stars, donations, supporter rankings, achievements, spin wheels, prize claims, and overlay notifications."
      items={["Stars wallet", "Spin wheel", "Prize claims"]}
    />
  );
}
