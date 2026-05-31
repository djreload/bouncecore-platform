import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";

type ModulePlaceholderProps = {
  title: string;
  eyebrow: string;
  description: string;
  items: string[];
};

export function PublicModulePlaceholder({ title, eyebrow, description, items }: ModulePlaceholderProps) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="cyan">{eyebrow}</Badge>
          <h1 className="mt-4 text-4xl font-black">{title}</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">{description}</p>
        </section>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5" key={item}>
              <Badge tone="muted">Planned</Badge>
              <h2 className="mt-4 text-xl font-black">{item}</h2>
              <p className="mt-2 text-sm text-bc-muted">Reserved for the next implementation phase.</p>
            </article>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
