import { timingSafeEqual } from "node:crypto";

const internalTaskTokenEnv = "INTERNAL_TASK_TOKEN";

type InternalTaskAuthResult =
  | {
      ok: true;
    }
  | {
      error: string;
      ok: false;
      status: 401 | 503;
    };

function configuredToken() {
  return process.env[internalTaskTokenEnv]?.trim() ?? "";
}

function requestToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() === "bearer" && token) {
    return token.trim();
  }

  return request.headers.get("x-internal-task-token")?.trim() ?? "";
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function internalTaskTokenConfigured() {
  return Boolean(configuredToken());
}

export function requireInternalTaskAuth(request: Request): InternalTaskAuthResult {
  const expected = configuredToken();

  if (!expected) {
    return {
      error: `${internalTaskTokenEnv} is not configured.`,
      ok: false,
      status: 503
    };
  }

  if (!constantTimeEquals(requestToken(request), expected)) {
    return {
      error: "Internal task token is invalid.",
      ok: false,
      status: 401
    };
  }

  return {
    ok: true
  };
}
