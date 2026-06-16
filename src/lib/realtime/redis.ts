import { createClient } from "redis";

type RedisRealtimeClient = {
  readonly isReady: boolean;
  connect(): Promise<RedisRealtimeClient>;
  destroy(): void;
  on(event: "error", listener: (error: Error) => void): RedisRealtimeClient;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, listener: (message: string) => void): Promise<void>;
  unsubscribe(channel: string, listener: (message: string) => void): Promise<void>;
};
export type RealtimeUnsubscribe = () => Promise<void>;

const redisConnectTimeoutMs = 750;
let publisherClient: RedisRealtimeClient | null = null;
let publisherConnection: Promise<RedisRealtimeClient | null> | null = null;

function redisUrl() {
  return process.env.REDIS_URL?.trim() ?? "";
}

function createRealtimeClient() {
  const url = redisUrl();

  if (!url) {
    return null;
  }

  const client = createClient({
    socket: {
      connectTimeout: redisConnectTimeoutMs,
      reconnectStrategy: false
    },
    url
  });

  client.on("error", () => {
    // Redis realtime is optional; callers fall back to database reads.
  });

  return client;
}

function destroyClient(client: RedisRealtimeClient | null) {
  try {
    client?.destroy();
  } catch {
    // The client may already be closed after a connection failure.
  }
}

async function getPublisherClient() {
  if (publisherClient?.isReady) {
    return publisherClient;
  }

  if (publisherConnection) {
    return publisherConnection;
  }

  destroyClient(publisherClient);
  publisherClient = null;

  publisherConnection = (async () => {
    const client = createRealtimeClient();

    if (!client) {
      return null;
    }

    try {
      await client.connect();
      publisherClient = client;
      return client;
    } catch {
      destroyClient(client);
      return null;
    } finally {
      publisherConnection = null;
    }
  })();

  return publisherConnection;
}

export function realtimeRedisConfigured() {
  return Boolean(redisUrl());
}

export async function publishRealtimeEvent(channel: string, payload: string) {
  const client = await getPublisherClient();

  if (!client) {
    return false;
  }

  try {
    await client.publish(channel, payload);
    return true;
  } catch {
    destroyClient(client);

    if (publisherClient === client) {
      publisherClient = null;
    }

    return false;
  }
}

export async function subscribeRealtimeEvent(channel: string, listener: (message: string) => void): Promise<RealtimeUnsubscribe | null> {
  const client = createRealtimeClient();

  if (!client) {
    return null;
  }

  try {
    await client.connect();
    await client.subscribe(channel, listener);

    return async () => {
      try {
        if (client.isReady) {
          await client.unsubscribe(channel, listener);
        }
      } catch {
        // Closing a browser tab can race with Redis cleanup.
      } finally {
        destroyClient(client);
      }
    };
  } catch {
    destroyClient(client);
    return null;
  }
}
