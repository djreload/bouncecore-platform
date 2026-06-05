function configuredAppOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function forwardedOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();

  if (!host) {
    return null;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = new URL(request.url).protocol.replace(":", "");
  const protocol = forwardedProto || requestProtocol || "https";

  return `${protocol}://${host}`;
}

export function appOrigin(request: Request) {
  return configuredAppOrigin() ?? forwardedOrigin(request) ?? new URL(request.url).origin;
}

export function appUrl(request: Request, path: string, params?: Record<string, string | null | undefined>) {
  const url = new URL(path, appOrigin(request));

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, value);
    }
  });

  return url;
}
