import type { LlmConfig } from "@mms/shared";
import { decryptSecretAtRest, encryptSecretAtRest } from "../../lib/cryptoAtRest.js";

const ENVELOPE_PREFIX = "enc:aes256gcm:";

function isPlaintextSecret(value: string | null | undefined): boolean {
  return Boolean(value && !value.startsWith(ENVELOPE_PREFIX));
}

/** Encrypt a single LLM API key for DB storage (idempotent for existing envelopes). */
export function encryptLlmApiKey(value?: string | null): string | null {
  const encrypted = encryptSecretAtRest(value);
  return encrypted ?? null;
}

/** Decrypt a stored LLM API key (plaintext legacy values pass through). */
export function decryptLlmApiKey(value?: string | null): string | undefined {
  return decryptSecretAtRest(value);
}

/** Encrypt each `apiKey` in an LLM config list for DB storage. */
export function encryptLlmConfigs(configs: LlmConfig[] | null | undefined): LlmConfig[] | null {
  if (!configs?.length) return null;
  return configs.map((config) => ({
    ...config,
    apiKey: encryptSecretAtRest(config.apiKey) ?? "",
  }));
}

/** Decrypt each `apiKey` in a stored LLM config list. */
export function decryptLlmConfigs(
  configs: LlmConfig[] | null | undefined,
): LlmConfig[] | undefined {
  if (!configs?.length) return undefined;
  return configs.map((config) => ({
    ...config,
    apiKey: decryptSecretAtRest(config.apiKey) ?? "",
  }));
}

/**
 * True when any LLM secret on the row still looks like plaintext (not an
 * `enc:aes256gcm:` envelope). Used by the backfill migration.
 */
export function workspaceLlmSecretsNeedEncryption(
  llmApiKey: string | null | undefined,
  llmConfigs: LlmConfig[] | null | undefined,
): boolean {
  if (isPlaintextSecret(llmApiKey)) return true;
  return (llmConfigs ?? []).some((config) => isPlaintextSecret(config.apiKey));
}
