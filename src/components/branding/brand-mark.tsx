"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
  logoUrl?: string | null;
  siteName: string;
};

export function BrandMark({ className, iconClassName, logoUrl, siteName }: BrandMarkProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric shadow-[0_0_26px_rgba(0,213,255,0.22)]",
        className
      )}
    >
      {showLogo ? (
        <img
          className="h-full w-full object-contain p-1"
          src={logoUrl ?? ""}
          alt={`${siteName} logo`}
          onError={() => setFailedLogoUrl(logoUrl ?? null)}
        />
      ) : (
        <Radio className={cn("h-5 w-5", iconClassName)} aria-hidden="true" />
      )}
    </span>
  );
}
