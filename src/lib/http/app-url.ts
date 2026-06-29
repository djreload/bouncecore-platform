function configuredAppOrigin() {
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

function forwardedOrigin(request: Request) {
  const forwardedHost = cleanForwardedHost(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || cleanForwardedHost(request.headers.get("host"));

  if (!host) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const requestProtocol = requestUrl.protocol === "http:" ? "http" : "https";
  const protocol = cleanForwardedProtocol(request.headers.get("x-forwarded-proto"), requestProtocol);

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
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
