function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asPathName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pathIsOnline(path: Record<string, unknown>) {
  const online = path.online ?? path.available ?? path.ready;
  const source = path.source;

  if (typeof online === "boolean") {
    return online;
  }

  return isObject(source);
}

export function mediaGatewayPathOnline(payload: unknown, pathName: string) {
  if (!isObject(payload)) {
    return null;
  }

  const items = asArray(payload.items);

  if (!items.length) {
    return false;
  }

  const path = items.find((item) => isObject(item) && asPathName(item.name) === pathName);

  return isObject(path) ? pathIsOnline(path) : false;
}
