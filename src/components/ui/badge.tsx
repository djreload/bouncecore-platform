import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "cyan" | "pink" | "acid" | "amber" | "muted";
  className?: string;
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  cyan: "border-bc-electric/40 bg-bc-electric/10 text-bc-electric",
  pink: "border-bc-pink/40 bg-bc-pink/10 text-bc-pink",
  acid: "border-bc-acid/40 bg-bc-acid/10 text-bc-acid",
  amber: "border-bc-amber/40 bg-bc-amber/10 text-bc-amber",
  muted: "border-bc-line bg-white/5 text-bc-muted"
};

export function Badge({ children, tone = "cyan", className }: BadgeProps) {
  return (
    <span className={cn("bc-badge inline-flex items-center rounded border px-2 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
