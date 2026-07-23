export type CoreFpsInvitePresence = {
  id: string;
  status: "online" | "away";
};

export function getCoreFpsInviteRecipientIds(
  presenceUsers: CoreFpsInvitePresence[],
  actorId: string
) {
  return [
    ...new Set(
      presenceUsers
        .filter((user) => user.id !== actorId && user.status === "online")
        .map((user) => user.id)
    )
  ];
}

export function coreFpsInviteActionUrl(activationId: string) {
  return `/games/core/play?invite=${encodeURIComponent(activationId)}`;
}
