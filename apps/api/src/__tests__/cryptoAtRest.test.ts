import { describe, it, expect } from "vitest";
import { encryptSecretAtRest, decryptSecretAtRest } from "../lib/cryptoAtRest.js";

describe("cryptoAtRest", () => {
  it("should encrypt and decrypt values symmetrically", () => {
    const secret = "ya29.a0AfH6SMDh9...sensitive-token...";
    const encrypted = encryptSecretAtRest(secret);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(secret);
    expect(encrypted?.startsWith("enc:aes256gcm:")).toBe(true);

    const decrypted = decryptSecretAtRest(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("should handle unencrypted legacy values gracefully (fallback)", () => {
    const legacyPlaintext = "plain-text-token-12345";
    const decrypted = decryptSecretAtRest(legacyPlaintext);
    expect(decrypted).toBe(legacyPlaintext);
  });

  it("should return undefined for empty/null values", () => {
    expect(encryptSecretAtRest(null)).toBeUndefined();
    expect(encryptSecretAtRest("")).toBeUndefined();
    expect(decryptSecretAtRest(null)).toBeUndefined();
    expect(decryptSecretAtRest("")).toBeUndefined();
  });

  it("should not double-encrypt already encrypted values", () => {
    const secret = "my-super-secret";
    const encrypted = encryptSecretAtRest(secret);
    const doubleEncrypted = encryptSecretAtRest(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
  });

  it("should handle custom encryption keys", () => {
    const secret = "custom-key-secret";
    const customKey = "custom-32-character-secret-key-!";
    const encrypted = encryptSecretAtRest(secret, customKey);
    expect(decryptSecretAtRest(encrypted, customKey)).toBe(secret);
    // Decrypting with wrong key fails gracefully
    expect(decryptSecretAtRest(encrypted, "wrong-key-value-1234567890123456")).toBeUndefined();
  });
});
