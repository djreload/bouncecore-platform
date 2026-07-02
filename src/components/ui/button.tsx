import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "bc-button bc-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,#00d5ff,#7deeff)] text-bc-void shadow-[0_0_28px_rgba(0,213,255,0.32)] hover:shadow-[0_0_34px_rgba(0,213,255,0.42)]",
        pink:
          "bg-[linear-gradient(135deg,#ff2bd6,#ff68e7)] text-white shadow-[0_0_28px_rgba(255,43,214,0.28)] hover:shadow-[0_0_34px_rgba(255,43,214,0.42)]",
        ghost:
          "border border-bc-line bg-white/5 text-white hover:border-bc-electric/60 hover:bg-bc-electric/10 hover:shadow-[0_0_24px_rgba(0,213,255,0.12)]",
        dark: "border border-bc-line bg-bc-panel text-white hover:border-bc-pink/60 hover:shadow-[0_0_24px_rgba(255,43,214,0.12)]"
      },
      size: {
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-10 px-4 text-sm",
        lg: "min-h-12 px-5 text-base"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants> & { className?: string };

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
