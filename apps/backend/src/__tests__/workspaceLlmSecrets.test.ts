import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptLlmApiKey,
  decryptLlmConfigs,
  encryptLlmApiKey,
  encryptLlmConfigs,
  workspaceLlmSecretsNeedEncryption,
} from "../db/repositories/workspaceLlmSecrets.js";
import { maskGlobalSettingsForClient, maskSecret } from "../services/globalSettingsService.js";
import type { LlmConfig } from "@mms/shared";

const sampleConfig = (apiKey: string): LlmConfig => ({
  id: "cfg-1",
  name: "Primary",
  provider: "openai",
  apiKey,
  model: "gpt-4o-mini",
  isDefaultText: true,
});

describe("workspaceLlmSecrets", () => {
  const previousJwt = process.env.JWT_SECRET;
  const previousAtRest = process.env.AT_REST_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-llm-encryption-32b";
    delete process.env.AT_REST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (previousJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwt;
    if (previousAtRest === undefined) delete process.env.AT_REST_ENCRYPTION_KEY;
    else process.env.AT_REST_ENCRYPTION_KEY = previousAtRest;
  });

  it("encrypts plaintext keys and decrypts back to the original", () => {
    const plaintext = "sk-live-secret-abcdef";
    const encrypted = encryptLlmApiKey(plaintext);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted!.startsWith("enc:aes256gcm:")).toBe(true);
    expect(decryptLlmApiKey(encrypted)).toBe(plaintext);
  });

  it("leaves already-encrypted envelopes unchanged on re-encrypt", () => {
    const encrypted = encryptLlmApiKey("sk-once");
    expect(encryptLlmApiKey(encrypted)).toBe(encrypted);
  });

  it("passes legacy plaintext through decrypt for read compatibility", () => {
    expect(decryptLlmApiKey("legacy-plain-key")).toBe("legacy-plain-key");
  });

  it("encrypts and decrypts llmConfigs apiKey fields", () => {
    const configs = [sampleConfig("cfg-secret-1111"), sampleConfig("cfg-secret-2222")];
    configs[1] = { ...configs[1], id: "cfg-2" };
    const encrypted = encryptLlmConfigs(configs);
    expect(encrypted).toHaveLength(2);
    expect(encrypted![0].apiKey.startsWith("enc:aes256gcm:")).toBe(true);
    expect(encrypted![1].apiKey.startsWith("enc:aes256gcm:")).toBe(true);

    const decrypted = decryptLlmConfigs(encrypted);
    expect(decrypted![0].apiKey).toBe("cfg-secret-1111");
    expect(decrypted![1].apiKey).toBe("cfg-secret-2222");
  });

  it("detects plaintext secrets that still need encryption", () => {
    expect(workspaceLlmSecretsNeedEncryption("sk-plain", null)).toBe(true);
    expect(workspaceLlmSecretsNeedEncryption(null, [sampleConfig("plain")])).toBe(true);
    const encryptedKey = encryptLlmApiKey("sk-done")!;
    const encryptedConfigs = encryptLlmConfigs([sampleConfig("done")]);
    expect(workspaceLlmSecretsNeedEncryption(encryptedKey, encryptedConfigs)).toBe(false);
    expect(workspaceLlmSecretsNeedEncryption(null, null)).toBe(false);
  });

  it("masks decrypted plaintext for clients, not ciphertext", () => {
    const plaintext = "sk-abcdefghijklmnop";
    const encrypted = encryptLlmApiKey(plaintext)!;
    const decrypted = decryptLlmApiKey(encrypted)!;
    expect(maskSecret(decrypted)).toBe("****mnop");
    expect(maskSecret(encrypted).startsWith("****")).toBe(true);
    // Client path must mask the decrypted value so last-4 is plaintext digits.
    const masked = maskGlobalSettingsForClient({
      language: "en",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
      emailNotifications: false,
      smsNotifications: false,
      twoFactor: false,
      sessionTimeout: "30",
      passwordPolicy: "standard",
      theme: "system",
      enabledModules: {},
      llmProvider: "openai",
      llmApiKey: decrypted,
      llmConfigs: [sampleConfig(decrypted)],
    } as never);
    expect(masked.llmApiKey).toBe("****mnop");
    expect(masked.llmConfigs[0].apiKey).toBe("****mnop");
  });
});
