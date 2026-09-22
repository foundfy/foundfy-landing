import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { TOKEN_ENCRYPTION_KEY_ID } from "./config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function parseTokenEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const fromBase64 = Buffer.from(trimmed, "base64");
  if (fromBase64.length === 32) {
    return fromBase64;
  }

  throw new Error("GSC_TOKEN_ENCRYPTION_KEY must be 32 bytes as hex or base64.");
}

export function getTokenEncryptionKey(): Buffer {
  const raw = (process.env.GSC_TOKEN_ENCRYPTION_KEY ?? "").replace(/\s+/g, "").trim();
  if (!raw) {
    throw new Error("GSC_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  return parseTokenEncryptionKey(raw);
}

export function encryptSecret(
  plaintext: string,
  key = getTokenEncryptionKey(),
  keyId = TOKEN_ENCRYPTION_KEY_ID,
): string {
  if (!plaintext) {
    throw new Error("Refusing to encrypt an empty secret.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    keyId,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(
  stored: string,
  key = getTokenEncryptionKey(),
): string {
  const parts = stored.split(".");
  if (parts.length !== 4) {
    throw new Error("Encrypted secret is not readable.");
  }

  const [, ivPart, tagPart, dataPart] = parts;
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Encrypted secret is not readable.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const data = Buffer.from(dataPart, "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptionKeyIdFromCiphertext(stored: string): string {
  const keyId = stored.split(".")[0];
  if (!keyId) {
    throw new Error("Encrypted secret is missing a key id.");
  }

  return keyId;
}
