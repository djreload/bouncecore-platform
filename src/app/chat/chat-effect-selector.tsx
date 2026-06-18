"use client";

import { Sparkles } from "lucide-react";
import { chatEffectGroups, getAvailableChatEffects } from "@/lib/chat/chat-effects";
import type { Role } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";

type ChatEffectSelectorProps = {
  className?: string;
  disabled?: boolean;
  selectedEffectId: string;
  userRoles: Role[];
  onChange: (effectId: string) => void;
};

const groupLabels: Record<(typeof chatEffectGroups)[number], string> = {
  free: "Free",
  supporter: "Supporter/VIP",
  staff: "Staff",
  developer: "Developer",
  owner: "Owner"
};

export function ChatEffectSelector({ className, disabled, onChange, selectedEffectId, userRoles }: ChatEffectSelectorProps) {
  const availableEffects = getAvailableChatEffects(userRoles);

  return (
    <label
      className={cn(
        "inline-flex min-h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md border border-bc-line bg-white/5 px-2 py-1 text-xs font-semibold text-white",
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-bc-acid" aria-hidden="true" />
      <span className="sr-only">Chat text effect</span>
      <select
        aria-label="Chat text effect"
        className="min-w-0 max-w-20 bg-transparent text-[inherit] text-white outline-none disabled:opacity-50 sm:max-w-28"
        disabled={disabled}
        name="effectId"
        onChange={(event) => onChange(event.target.value)}
        value={selectedEffectId}
      >
        <option className="bg-bc-panel text-white" value="">
          None
        </option>
        {chatEffectGroups.map((group) => {
          const effects = availableEffects.filter((effect) => effect.group === group);

          return effects.length ? (
            <optgroup className="bg-bc-panel text-white" key={group} label={groupLabels[group]}>
              {effects.map((effect) => (
                <option className="bg-bc-panel text-white" key={effect.id} value={effect.id}>
                  {effect.displayName}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </label>
  );
}
