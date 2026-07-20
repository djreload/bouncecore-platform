import { raveWarDiagnosticStaleMs } from "@/lib/rave-wars/rave-war-diagnostics-core";

export const raveWarStalledOperatorAlertType = "admin.rave-war.stalled";

export type RaveWarStalledAlertInput = {
  participantNames: string[];
  roomName: string;
  warId: string;
};

function matchLabel(participantNames: string[]) {
  const names = participantNames.map((name) => name.trim()).filter(Boolean).slice(0, 2);

  return names.length ? names.join(" vs ") : "Active Rave War";
}

export function raveWarStalledOperatorAlertDedupeKey(input: {
  revision: number;
  userId: string;
  warId: string;
}) {
  return `${raveWarStalledOperatorAlertType}:${input.warId}:revision:${Math.max(0, Math.trunc(input.revision))}:user:${input.userId}`;
}

export function raveWarStalledOperatorAlertContent(input: RaveWarStalledAlertInput) {
  const label = matchLabel(input.participantNames);
  const staleSeconds = Math.round(raveWarDiagnosticStaleMs / 1000);

  return {
    actionUrl: `/admin/rave-wars/${encodeURIComponent(input.warId)}`,
    body: `${label} in ${input.roomName} has recorded no server activity for at least ${staleSeconds} seconds. Open diagnostics before resyncing or ending the match.`,
    title: `Rave War stalled: ${label}`,
    type: raveWarStalledOperatorAlertType
  };
}
