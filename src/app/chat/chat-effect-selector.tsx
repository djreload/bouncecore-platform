"use client";

import { Sparkles } from "lucide-react";
import { chatEffectGroups, getAvailableChatEffects } from "@/lib/chat/chat-effects";
import type { Role } from "@/lib/auth/rbac";

type ChatEffectSelectorProps = {
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

export function ChatEffectSelector({ disabled, onChange, selectedEffectId, userRoles }: ChatEffectSelectorProps) {
  const availableEffects = getAvailableChatEffects(userRoles);

  return (
    <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-bc-line bg-white/5 px-3 py-2 text-sm font-semibold text-white">
      <Sparkles className="h-4 w-4 text-bc-acid" aria-hidden="true" />
      <span className="sr-only">Chat text effect</span>
      <select
        aria-label="Chat text effect"
        className="max-w-36 bg-transparent text-sm text-white outline-none disabled:opacity-50"
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
