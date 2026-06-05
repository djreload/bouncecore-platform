import { Palette, SwatchBook } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";

const tokens = [
  { label: "Void", css: "--color-bc-void", value: "#05050a", use: "Global page background" },
  { label: "Ink", css: "--color-bc-ink", value: "#0b0d14", use: "Shell sidebars and footer bands" },
  { label: "Panel", css: "--color-bc-panel", value: "#111421", use: "Primary panels and cards" },
  { label: "Panel 2", css: "--color-bc-panel-2", value: "#171a2a", use: "Secondary panels" },
  { label: "Line", css: "--color-bc-line", value: "#2b3148", use: "Borders and dividers" },
  { label: "Muted", css: "--color-bc-muted", value: "#a7b0c4", use: "Secondary text" },
  { label: "Electric", css: "--color-bc-electric", value: "#00d5ff", use: "Primary actions and cyan badges" },
  { label: "Pink", css: "--color-bc-pink", value: "#ff2bd6", use: "Accent actions and alerts" },
  { label: "Acid", css: "--color-bc-acid", value: "#b6ff2e", use: "Success, stars, and positive status" },
  { label: "Violet", css: "--color-bc-violet", value: "#8b5cf6", use: "Secondary accent" },
  { label: "Amber", css: "--color-bc-amber", value: "#ffb020", use: "Warnings and attention states" }
];

const componentNotes = [
  "Cards use 8px or smaller radius through `rounded-md`.",
  "Badge tones map to cyan, pink, acid, amber, and muted UI states.",
  "Star alert animations use dedicated `bc-star-alert-*` CSS classes.",
  "The current production theme is code-defined in `src/app/globals.css`."
];

export default async function AdminThemesPage() {
  return (
    <AdminShell
      title="Themes"
      description="Inspect the active Bouncecore palette, component tone rules, and current theme implementation."
      requiredPermission="site.manage"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Tokens</Badge>
          <p className="mt-4 text-3xl font-black">{tokens.length}</p>
          <p className="mt-2 text-sm text-bc-muted">CSS theme tokens in active use.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Mode</Badge>
          <p className="mt-4 text-3xl font-black">Dark</p>
          <p className="mt-2 text-sm text-bc-muted">The app declares a dark colour scheme globally.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Source</Badge>
          <p className="mt-4 text-3xl font-black">CSS</p>
          <p className="mt-2 text-sm text-bc-muted">Defined in Tailwind 4 `@theme` variables.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="pink">Palette</Badge>
            <h3 className="mt-4 text-2xl font-black">Active theme tokens</h3>
          </div>
          <Palette className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tokens.map((token) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={token.css}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="h-12 w-12 shrink-0 rounded-md border border-white/15"
                  style={{ backgroundColor: token.value }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black">{token.label}</h4>
                    <Badge tone="muted">{token.value}</Badge>
                  </div>
                  <p className="mt-1 break-all text-xs text-bc-muted">{token.css}</p>
                  <p className="mt-2 text-sm text-bc-muted">{token.use}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-3">
          <SwatchBook className="h-6 w-6 text-bc-electric" aria-hidden="true" />
          <h3 className="text-xl font-black">Theme management status</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {componentNotes.map((note) => (
            <div className="rounded-md border border-bc-line bg-bc-ink p-3 text-sm text-bc-muted" key={note}>
              {note}
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
