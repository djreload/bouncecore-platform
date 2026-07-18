import { ListTree } from "lucide-react";

type SectionJumpNavProps = {
  items: Array<{
    href: `#${string}`;
    label: string;
  }>;
  label: string;
};

export function SectionJumpNav({ items, label }: SectionJumpNavProps) {
  return (
    <nav
      aria-label={label}
      className="sticky top-2 z-30 overflow-x-auto rounded-md border border-bc-line bg-bc-ink/95 p-2 shadow-xl shadow-black/20 backdrop-blur"
    >
      <div className="flex min-w-max items-center gap-1">
        <span className="mr-1 inline-flex items-center gap-2 px-2 text-xs font-black uppercase text-bc-muted">
          <ListTree className="h-4 w-4 text-bc-electric" aria-hidden="true" />
          {label}
        </span>
        {items.map((item) => (
          <a
            className="bc-focus-ring rounded-md border border-transparent px-3 py-2 text-xs font-semibold text-bc-muted transition hover:border-bc-electric/45 hover:bg-bc-electric/10 hover:text-white"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
