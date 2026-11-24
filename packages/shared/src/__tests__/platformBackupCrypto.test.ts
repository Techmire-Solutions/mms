import { describe, expect, it } from "vitest";
import {
  PLATFORM_BACKUP_FORMAT_ID,
  decryptPlatformBackup,
  decryptWorkspaceBackup,
  encryptPlatformBackup,
  encryptWorkspaceBackup,
  isPlatformBackupPayload,
  parsePlatformBackupFile,
} from "../backup/backupCrypto.js";

const credentials = { adminEmail: "ops@acme.test", password: "correct horse battery staple" };

describe("platform configuration backup envelope", () => {
  it("round-trips a platform snapshot", async () => {
    const file = await encryptPlatformBackup(JSON.stringify({ hello: "world" }), credentials);
    expect(isPlatformBackupPayload(file)).toBe(true);
    expect(parsePlatformBackupFile(file)?.format).toBe(PLATFORM_BACKUP_FORMAT_ID);
    const decrypted = await decryptPlatformBackup(file, credentials);
    expect(decrypted.ok).toBe(true);
    if (decrypted.ok) expect(decrypted.plaintext).toBe(JSON.stringify({ hello: "world" }));
  });

  it("rejects the wrong email and a workspace envelope", async () => {
    const file = await encryptPlatformBackup("{}", credentials);
    const wrongEmail = await decryptPlatformBackup(file, {
      ...credentials,
      adminEmail: "other@acme.test",
    });
    expect(wrongEmail).toEqual({ ok: false, errorKey: "backup.decryptEmailMismatch" });

    const workspaceFile = await encryptWorkspaceBackup("{}", credentials);
    const crossFormat = await decryptPlatformBackup(workspaceFile, credentials);
    expect(crossFormat).toEqual({ ok: false, errorKey: "backup.invalidFormat" });
  });

  it("keeps workspace backups decryptable after the shared refactor", async () => {
    const file = await encryptWorkspaceBackup("{}", credentials);
    const decrypted = await decryptWorkspaceBackup(file, credentials);
    expect(decrypted.ok).toBe(true);
  });
});
