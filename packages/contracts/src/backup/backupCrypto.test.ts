import { describe, expect, it } from "vitest";
import {
  BACKUP_KDF_MAX_ITERATIONS,
  BACKUP_KDF_MIN_ITERATIONS,
  ENCRYPTED_BACKUP_VERSION,
  decryptWorkspaceBackup,
  encryptWorkspaceBackup,
  isEncryptedBackupPayload,
  parseEncryptedBackupFile,
} from "./backupCrypto.js";
import { buildWorkspaceBackupEnvelope } from "./backupTypes.js";

const CREDS = { adminEmail: "admin@madrasa.app", password: "Pa$$w0rd" };

async function encryptedWith(overrides: Record<string, unknown>): Promise<string> {
  const encrypted = await encryptWorkspaceBackup('{"test":true}', CREDS);
  return JSON.stringify({ ...(JSON.parse(encrypted) as Record<string, unknown>), ...overrides });
}

describe("backupCrypto", () => {
  it("encrypts and decrypts a workspace backup", async () => {
    const plaintext = buildWorkspaceBackupEnvelope(
      { "mms_t:demo:students": "[]" },
      { subdomain: "demo", dataSource: "server" },
    );
    const encrypted = await encryptWorkspaceBackup(plaintext, CREDS, {
      subdomain: "demo",
      tenantLabel: "Dar ul Quran",
    });
    expect(isEncryptedBackupPayload(encrypted)).toBe(true);

    const result = await decryptWorkspaceBackup(encrypted, CREDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plaintext).toBe(plaintext);
      expect(result.meta.tenantLabel).toBe("Dar ul Quran");
    }
  });

  it("rejects wrong password", async () => {
    const encrypted = await encryptWorkspaceBackup('{"test":true}', CREDS);
    const result = await decryptWorkspaceBackup(encrypted, {
      adminEmail: CREDS.adminEmail,
      password: "wrong",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe("backup.decryptFailed");
    }
  });

  it("rejects an iteration count outside the accepted KDF range", async () => {
    const tooHigh = await encryptedWith({ iterations: BACKUP_KDF_MAX_ITERATIONS + 1 });
    const tooLow = await encryptedWith({ iterations: BACKUP_KDF_MIN_ITERATIONS - 1 });

    expect(parseEncryptedBackupFile(tooHigh)).toBeNull();
    expect(parseEncryptedBackupFile(tooLow)).toBeNull();
    await expect(decryptWorkspaceBackup(tooHigh, CREDS)).resolves.toEqual({
      ok: false,
      errorKey: "backup.invalidFormat",
    });
  });

  it("rejects a wrapper written by a newer format version", async () => {
    const future = await encryptedWith({ version: ENCRYPTED_BACKUP_VERSION + 1 });
    expect(parseEncryptedBackupFile(future)).toBeNull();
  });

  it("rejects email mismatch", async () => {
    const encrypted = await encryptWorkspaceBackup('{"test":true}', CREDS);
    const result = await decryptWorkspaceBackup(encrypted, {
      adminEmail: "other@madrasa.app",
      password: CREDS.password,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe("backup.decryptEmailMismatch");
    }
  });
});
