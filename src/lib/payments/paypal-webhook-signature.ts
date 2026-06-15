import { createVerify } from "crypto";

export type PayPalWebhookSignatureHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  crcTable[index] = value >>> 0;
}

export function extractPayPalWebhookHeaders(headers: Headers): PayPalWebhookSignatureHeaders {
  const values: PayPalWebhookSignatureHeaders = {
    authAlgo: headers.get("paypal-auth-algo")?.trim() ?? "",
    certUrl: headers.get("paypal-cert-url")?.trim() ?? "",
    transmissionId: headers.get("paypal-transmission-id")?.trim() ?? "",
    transmissionSig: headers.get("paypal-transmission-sig")?.trim() ?? "",
    transmissionTime: headers.get("paypal-transmission-time")?.trim() ?? ""
  };

  if (!values.authAlgo || !values.certUrl || !values.transmissionId || !values.transmissionSig || !values.transmissionTime) {
    throw new Error("PayPal webhook signature headers are incomplete.");
  }

  return values;
}

export function crc32Decimal(input: string) {
  const body = Buffer.from(input, "utf8");
  let checksum = 0xffffffff;

  for (const byte of body) {
    checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }

  return (checksum ^ 0xffffffff) >>> 0;
}

export function payPalWebhookSignedMessage(headers: PayPalWebhookSignatureHeaders, webhookId: string, rawBody: string) {
  return `${headers.transmissionId}|${headers.transmissionTime}|${webhookId}|${crc32Decimal(rawBody)}`;
}

export function certUrlIsAllowedPayPalUrl(certUrl: string) {
  try {
    const url = new URL(certUrl);
    const allowedHosts = new Set(["api-m.paypal.com", "api-m.sandbox.paypal.com", "api.paypal.com", "api.sandbox.paypal.com"]);

    return url.protocol === "https:" && allowedHosts.has(url.hostname) && url.pathname.startsWith("/v1/notifications/certs/");
  } catch {
    return false;
  }
}

export function verifyPayPalWebhookSignature(
  headers: PayPalWebhookSignatureHeaders,
  webhookId: string,
  rawBody: string,
  certificatePem: string
) {
  if (!webhookId.trim()) {
    throw new Error("PayPal webhook ID is not configured.");
  }

  if (headers.authAlgo !== "SHA256withRSA") {
    throw new Error(`Unsupported PayPal webhook signature algorithm: ${headers.authAlgo}.`);
  }

  const verifier = createVerify("SHA256");

  verifier.update(payPalWebhookSignedMessage(headers, webhookId, rawBody));
  verifier.end();

  return verifier.verify(certificatePem, Buffer.from(headers.transmissionSig, "base64"));
}
