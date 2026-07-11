export function configuredAppOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function cleanForwardedHost(value: string | null) {
  const host = value?.split(",")[0]?.trim() ?? "";

  if (!host || /[\s/@\\]/.test(host)) {
    return null;
  }

  return host;
}

function cleanForwardedProtocol(value: string | null, fallback: string) {
  const protocol = value?.split(",")[0]?.trim().toLowerCase() || fallback;

  return protocol === "https" || protocol === "http" ? protocol : fallback;
}

function forwardedOriginFromParts({
  fallbackProtocol,
  forwardedHost,
  forwardedProtocol,
  host
}: {
  fallbackProtocol: string;
  forwardedHost: string | null;
  forwardedProtocol: string | null;
  host: string | null;
}) {
  const cleanHost = cleanForwardedHost(forwardedHost) || cleanForwardedHost(host);

  if (!cleanHost) {
    return null;
  }

  const protocol = cleanForwardedProtocol(forwardedProtocol, fallbackProtocol);

  try {
    return new URL(`${protocol}://${cleanHost}`).origin;
  } catch {
    return null;
  }
}

function forwardedOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const requestProtocol = requestUrl.protocol === "http:" ? "http" : "https";

  return forwardedOriginFromParts({
    fallbackProtocol: requestProtocol,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProtocol: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host")
  });
}

export function appOriginFromHeaders(requestHeaders: Headers) {
  return (
    configuredAppOrigin() ??
    forwardedOriginFromParts({
      fallbackProtocol: "https",
      forwardedHost: requestHeaders.get("x-forwarded-host"),
      forwardedProtocol: requestHeaders.get("x-forwarded-proto"),
      host: requestHeaders.get("host")
    })
  );
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
