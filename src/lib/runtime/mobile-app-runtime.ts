export const bouncecoreAndroidUserAgentToken = "BouncecoreAndroid/";

export function isBouncecoreAndroidUserAgent(userAgent: string) {
  const normalizedUserAgent = userAgent.toLowerCase();

  return (
    userAgent.includes(bouncecoreAndroidUserAgentToken) ||
    (normalizedUserAgent.includes("android") && normalizedUserAgent.includes("; wv"))
  );
}

export function isBouncecoreAndroidRuntime() {
  return typeof navigator !== "undefined" && isBouncecoreAndroidUserAgent(navigator.userAgent);
}
