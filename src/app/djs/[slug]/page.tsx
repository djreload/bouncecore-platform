import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export default async function DjProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="cyan">Public DJ profile</Badge>
          <h1 className="mt-4 text-4xl font-black">{slug.replaceAll("-", " ")}</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Public profiles expose identity, schedule, verification, and live/offline state only. Private stream keys
            never appear here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge tone="muted">Offline</Badge>
            <Badge tone="acid">Stream enabled</Badge>
            <Badge tone="pink">Verified placeholder</Badge>
          </div>
          <ButtonLink className="mt-7" href="/live">
            Watch live page
          </ButtonLink>
        </section>
      </main>
    </PublicShell>
  );
}
