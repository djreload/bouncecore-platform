import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const secretEncryptionKeyEnv = "PUSH_TOKEN_ENCRYPTION_KEY";
const secretCipherPrefix = "v1";

function keyMaterial() {
  return process.env[secretEncryptionKeyEnv]?.trim() ?? "";
}

function encryptionKey() {
  const material = keyMaterial();

  if (!material) {
    return null;
  }

  return createHash("sha256").update(material).digest();
}

export function secretEncryptionConfigured() {
  return Boolean(keyMaterial());
}

export function encryptSecret(value: string) {
  const key = encryptionKey();

  if (!key) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    secretCipherPrefix,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

export function decryptSecret(payload: string) {
  const key = encryptionKey();

  if (!key) {
    throw new Error(`${secretEncryptionKeyEnv} is required to decrypt stored secrets.`);
  }

  const [version, iv, authTag, ciphertext] = payload.split(".");

  if (version !== secretCipherPrefix || !iv || !authTag || !ciphertext) {
    throw new Error("Encrypted secret payload is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
