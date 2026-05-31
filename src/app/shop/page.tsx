import { PublicModulePlaceholder } from "@/components/ui/module-placeholder";

export default function ShopPage() {
  return (
    <PublicModulePlaceholder
      title="Bouncecore Shop"
      eyebrow="Merch"
      description="The shop foundation is planned for physical products, variants, stock, carts, checkout, orders, fulfilment, and customer history."
      items={["Products", "Cart", "Orders"]}
    />
  );
}
