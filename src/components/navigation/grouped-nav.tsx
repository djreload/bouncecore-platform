import { groupNavigation, type NavigationItem } from "@/config/navigation";
import { NavList } from "@/components/navigation/nav-list";

type GroupedNavProps = {
  items: NavigationItem[];
};

export function GroupedNav({ items }: GroupedNavProps) {
  const groups = groupNavigation(items);

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([group, groupItems]) => (
        <section key={group}>
          <h2 className="mb-2 px-3 text-xs font-semibold uppercase text-bc-muted">{group}</h2>
          <NavList items={groupItems} />
        </section>
      ))}
    </div>
  );
}
