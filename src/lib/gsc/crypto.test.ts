import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  encryptionKeyIdFromCiphertext,
  parseTokenEncryptionKey,
} from "./crypto";

const KEY = parseTokenEncryptionKey("a".repeat(64));
const OTHER_KEY = parseTokenEncryptionKey("b".repeat(64));

describe("GSC token encryption", () => {
  it("round-trips a refresh token and stores a key id for rotation", () => {
    const plaintext = "1//refresh-token-value";
    const stored = encryptSecret(plaintext, KEY, "v1");

    expect(stored).not.toContain(plaintext);
    expect(encryptionKeyIdFromCiphertext(stored)).toBe("v1");
    expect(decryptSecret(stored, KEY)).toBe(plaintext);
  });

  it("uses a random IV so the same token does not encrypt identically", () => {
    const plaintext = "1//refresh-token-value";
    expect(encryptSecret(plaintext, KEY)).not.toBe(encryptSecret(plaintext, KEY));
  });

  it("rejects decryption with the wrong key", () => {
    const stored = encryptSecret("1//refresh-token-value", KEY);
    expect(() => decryptSecret(stored, OTHER_KEY)).toThrow();
  });
});
