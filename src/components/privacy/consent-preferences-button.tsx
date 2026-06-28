"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { privacyChoicesEventName } from "@/lib/privacy/privacy-config";

type ConsentPreferencesButtonProps = {
  className?: string;
};

export function ConsentPreferencesButton({ className }: ConsentPreferencesButtonProps) {
  return (
    <Button
      className={className}
      onClick={() => window.dispatchEvent(new Event(privacyChoicesEventName))}
      type="button"
      variant="ghost"
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      Cookie choices
    </Button>
  );
}
