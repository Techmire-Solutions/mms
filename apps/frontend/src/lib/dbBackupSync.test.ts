import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKUP_FORMAT_ID } from "@mms/shared";

// Control the current tenant subdomain so the API client enforces a workspace
// match without depending on window.location hostname parsing.
const { currentSubdomain } = vi.hoisted(() => ({
  currentSubdomain: vi.fn(() => "demo"),
}));

vi.mock("@/lib/config/tenantConfig", () => ({
  getCurrentSubdomain: () => currentSubdomain(),
}));

const PREFIX = "mms_t:demo:";

function envelopeJson(subdomain: string, keys: Record<string, string>): string {
  return JSON.stringify({
    format: BACKUP_FORMAT_ID,
    version: 1,
    exportedAt: "2026-06-23T00:00:00Z",
    subdomain,
    stats: {
      keyCount: Object.keys(keys).length,
      collectionCount: 1,
      objectCount: 0,
      byteSize: 100,
    },
    keys,
  });
}

const validDemoBackup = (): string =>
  envelopeJson("demo", {
    [`${PREFIX}users`]: '[{"id":"1","role":"admin"}]',
    [`${PREFIX}branding`]: '{"madrasaName":"Demo"}',
  });

describe("importDatabase", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    currentSubdomain.mockReturnValue("demo");
    localStorage.clear();
  });

  it("rejects a backup whose envelope subdomain differs from the current tenant before any request", async () => {
    currentSubdomain.mockReturnValue("demo");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { importDatabase } = await import("@/lib/dbBackupSync");
    const foreignBackup = envelopeJson("other", {
      "mms_t:other:users": '[{"id":"1","role":"admin"}]',
    });
    await expect(importDatabase(foreignBackup)).rejects.toThrow("backup.workspaceMismatch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a legacy backup with no envelope subdomain", async () => {
    currentSubdomain.mockReturnValue("demo");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { importDatabase } = await import("@/lib/dbBackupSync");
    // Flat (non-envelope) backup: raw mms_ keys, no subdomain to match against.
    const legacyBackup = JSON.stringify({
      "mms_t:demo:users": '[{"id":"1","role":"admin"}]',
    });
    await expect(importDatabase(legacyBackup)).rejects.toThrow("backup.workspaceUnidentified");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("translates a 408 server timeout to backup.syncTimeout and leaves the local cache intact", async () => {
    currentSubdomain.mockReturnValue("demo");
    localStorage.setItem(`${PREFIX}branding`, '{"madrasaName":"Old"}');
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "backup.syncTimeout" }), {
        status: 408,
      })) as unknown as typeof fetch;
    const { importDatabase } = await import("@/lib/dbBackupSync");
    await expect(importDatabase(validDemoBackup())).rejects.toThrow("backup.syncTimeout");
    // A timed-out restore rolls back server-side, so the local cache must stay valid.
    expect(localStorage.getItem(`${PREFIX}branding`)).toBe('{"madrasaName":"Old"}');
  });

  it("posts the validated snapshot to /api/db/sync and rehydrates singleton objects on success", async () => {
    currentSubdomain.mockReturnValue("demo");
    let postedBody:
      { collections: Record<string, unknown[]>; objects: Record<string, unknown> } | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      postedBody = JSON.parse(init?.body as string) as typeof postedBody;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const { importDatabase } = await import("@/lib/dbBackupSync");
    await importDatabase(validDemoBackup());
    expect(postedBody?.collections?.users).toEqual([{ id: "1", role: "admin" }]);
    expect(postedBody?.objects?.branding).toEqual({ madrasaName: "Demo" });
    // Singleton object rehydrated into the local cache for a coherent first paint.
    expect(localStorage.getItem(`${PREFIX}branding`)).toContain("Demo");
  });
});
