import { publishRealtimeEvent, subscribeRealtimeEvent, type RealtimeUnsubscribe } from "@/lib/realtime/redis";

type RaveWarChangedPayload = {
  changedAt: string;
  eventId?: string;
  type: "rave-war.changed";
  warId: string;
};

function raveWarChannel(warId: string) {
  return `rave-war:${warId}`;
}

export async function publishRaveWarChanged(warId: string, eventId?: string) {
  const payload: RaveWarChangedPayload = {
    changedAt: new Date().toISOString(),
    ...(eventId ? { eventId } : {}),
    type: "rave-war.changed",
    warId
  };

  return publishRealtimeEvent(raveWarChannel(warId), JSON.stringify(payload));
}

export async function subscribeToRaveWarChanges(warId: string, onChange: () => void): Promise<RealtimeUnsubscribe | null> {
  return subscribeRealtimeEvent(raveWarChannel(warId), (message) => {
    try {
      const payload = JSON.parse(message) as Partial<RaveWarChangedPayload>;

      if (payload.type === "rave-war.changed" && payload.warId === warId) {
        onChange();
      }
    } catch {
      onChange();
    }
  });
}
