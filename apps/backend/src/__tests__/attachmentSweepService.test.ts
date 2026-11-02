import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runAttachmentSweep } from "../services/attachmentSweepService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedFile(
  root: string,
  tenant: string,
  file: string,
  ageMs: number,
): Promise<string> {
  const dir = join(root, "tenants", tenant, "attachments");
  await mkdir(dir, { recursive: true });
  const path = join(dir, file);
  await writeFile(path, "data");
  const at = new Date(Date.now() - ageMs);
  await utimes(path, at, at);
  return path;
}

describe("attachment orphan sweep", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mms-sweep-"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports only old unreferenced files in dry-run mode", async () => {
    const old = await seedFile(root, "demo", "old.pdf", 2 * DAY_MS);
    const fresh = await seedFile(root, "demo", "fresh.pdf", 1_000);
    const kept = await seedFile(root, "demo", "kept.pdf", 2 * DAY_MS);

    const result = await runAttachmentSweep({
      apply: false,
      root,
      loadReferencedKeys: async () => new Set(["demo/kept.pdf"]),
    });

    expect(result).toMatchObject({ scanned: 3, referencedKeys: 1, orphans: 1, deleted: 0 });
    expect(result.orphanFiles.map((file) => file.file)).toEqual(["old.pdf"]);
    await expect(stat(old)).resolves.toBeDefined();
    await expect(stat(fresh)).resolves.toBeDefined();
    await expect(stat(kept)).resolves.toBeDefined();
  });

  it("deletes only old unreferenced files when applying", async () => {
    const old = await seedFile(root, "demo", "old.pdf", 2 * DAY_MS);
    const fresh = await seedFile(root, "demo", "fresh.pdf", 1_000);
    const kept = await seedFile(root, "demo", "kept.pdf", 2 * DAY_MS);

    const result = await runAttachmentSweep({
      apply: true,
      root,
      loadReferencedKeys: async () => new Set(["demo/kept.pdf"]),
    });

    expect(result.deleted).toBe(1);
    await expect(stat(old)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(fresh)).resolves.toBeDefined();
    await expect(stat(kept)).resolves.toBeDefined();
  });

  it("deletes nothing when the reference query fails", async () => {
    const old = await seedFile(root, "demo", "old.pdf", 2 * DAY_MS);

    await expect(
      runAttachmentSweep({
        apply: true,
        root,
        loadReferencedKeys: async () => {
          throw new Error("database unavailable");
        },
      }),
    ).rejects.toThrow("database unavailable");
    await expect(stat(old)).resolves.toBeDefined();
  });

  it("returns zeros when the uploads root has no tenant attachments", async () => {
    const result = await runAttachmentSweep({
      apply: false,
      root,
      loadReferencedKeys: async () => new Set(),
    });
    expect(result).toMatchObject({ scanned: 0, referencedKeys: 0, orphans: 0, deleted: 0 });
  });
});
