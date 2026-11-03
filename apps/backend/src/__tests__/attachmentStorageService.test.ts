import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const mockWithTenantRead = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: (...args: unknown[]) => mockWithTenantRead(...args),
}));

import {
  attachmentFileKey,
  deleteTenantAttachment,
  isAttachmentReferenced,
  resolveTenantAttachmentPath,
  selectOrphanAttachmentFiles,
} from "../services/attachmentStorageService.js";

describe("attachment storage keys and paths", () => {
  beforeEach(() => {
    vi.stubEnv("MMS_UPLOADS_DIR", "/tmp/mms-attachment-test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keys relative and absolute tenant attachment URLs identically", () => {
    expect(attachmentFileKey("/uploads/tenants/Demo/attachments/a.pdf")).toBe("demo/a.pdf");
    expect(
      attachmentFileKey("https://demo.example/uploads/tenants/demo/attachments/a.pdf?x=1"),
    ).toBe("demo/a.pdf");
  });

  it("rejects non-attachment, foreign, traversal and script URLs", () => {
    expect(attachmentFileKey("/uploads/tenants/demo/exports/a.csv")).toBeNull();
    expect(attachmentFileKey("/uploads/tenants/demo/attachments/../secret")).toBeNull();
    expect(attachmentFileKey("/uploads/tenants/demo/attachments/%2e%2e/secret")).toBeNull();
    expect(attachmentFileKey("/uploads/tenants/demo/attachments/sub/a.pdf")).toBeNull();
    expect(attachmentFileKey("javascript:alert(1)")).toBeNull();
    expect(attachmentFileKey("data:text/html,x")).toBeNull();
    expect(attachmentFileKey("")).toBeNull();
  });

  it("resolves only the caller's tenant attachment directory", () => {
    expect(resolveTenantAttachmentPath("demo", "/uploads/tenants/demo/attachments/a.pdf")).toBe(
      resolve("/tmp/mms-attachment-test", "tenants", "demo", "attachments", "a.pdf"),
    );
    expect(
      resolveTenantAttachmentPath("other", "/uploads/tenants/demo/attachments/a.pdf"),
    ).toBeNull();
  });

  it("selects only old, unreferenced files", () => {
    const now = 1_000_000_000;
    const day = 24 * 60 * 60 * 1000;
    const files = [
      { tenant: "demo", file: "old.pdf", path: "/x", mtimeMs: now - 2 * day },
      { tenant: "demo", file: "fresh.pdf", path: "/y", mtimeMs: now - 1_000 },
      { tenant: "demo", file: "kept.pdf", path: "/z", mtimeMs: now - 2 * day },
    ];
    const orphans = selectOrphanAttachmentFiles(files, new Set(["demo/kept.pdf"]), now, day);
    expect(orphans.map((file) => file.file)).toEqual(["old.pdf"]);
  });

  it("deletes an existing file idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "mms-attachments-"));
    vi.stubEnv("MMS_UPLOADS_DIR", root);
    const dir = join(root, "tenants", "demo", "attachments");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "a.pdf"), "data");

    await expect(
      deleteTenantAttachment("demo", "/uploads/tenants/demo/attachments/a.pdf"),
    ).resolves.toBe(true);
    await expect(
      deleteTenantAttachment("demo", "/uploads/tenants/demo/attachments/a.pdf"),
    ).resolves.toBe(false);
  });
});

describe("attachment references", () => {
  beforeEach(() => {
    mockWithTenantRead.mockReset();
  });

  it("reports a referenced URL from the contact attachment table", async () => {
    mockWithTenantRead.mockImplementation(
      async (_tenant: string, cb: (tx: never) => Promise<unknown>) =>
        cb({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: "att-1" }],
              }),
            }),
          }),
        } as never),
    );

    await expect(
      isAttachmentReferenced("demo", "/uploads/tenants/demo/attachments/a.pdf"),
    ).resolves.toBe(true);
  });

  it("reports unreferenced URLs", async () => {
    mockWithTenantRead.mockImplementation(
      async (_tenant: string, cb: (tx: never) => Promise<unknown>) =>
        cb({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        } as never),
    );

    await expect(
      isAttachmentReferenced("demo", "/uploads/tenants/demo/attachments/a.pdf"),
    ).resolves.toBe(false);
  });
});
