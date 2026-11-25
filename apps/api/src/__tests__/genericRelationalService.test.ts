import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runWithTenant } from "../lib/tenantContext.js";
import { createGenericRelationalService } from "../services/genericRelationalService.js";

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
}));

describe("createGenericRelationalService restoreById", () => {
  it("writes null soft-delete fields so JSONB merge clears old values", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = createGenericRelationalService({
      repo: {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue({
          id: "record-1",
          name: "Archived",
          deletedAt: "2026-07-27T12:00:00.000Z",
          deletedBy: "user-1",
          deletionReason: "Duplicate",
        }),
        save,
      },
      schema: z.object({
        id: z.string(),
        name: z.string(),
        deletedAt: z.string().nullable().optional(),
        deletedBy: z.string().nullable().optional(),
        deletionReason: z.string().nullable().optional(),
        restoredAt: z.string().nullable().optional(),
        restoredBy: z.string().nullable().optional(),
      }),
      websocketCollection: "records",
      idPrefix: "record",
    });

    const restored = await runWithTenant("demo", () =>
      service.restoreById("record-1", "restorer-1"),
    );

    expect(restored).toBe(true);
    expect(save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredBy: "restorer-1",
      }),
    );
  });

  it("create generates a new id when incoming id is empty string or whitespace", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = createGenericRelationalService({
      repo: {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(null),
        save,
      },
      schema: z.object({
        id: z.string(),
        name: z.string(),
      }),
      websocketCollection: "records",
      idPrefix: "rec",
    });

    const created = await runWithTenant("demo", () => service.create({ id: "", name: "Test" }));
    expect(created.id).toMatch(/^rec-[0-9a-f-]{36}$/);
    expect(save).toHaveBeenCalledWith("demo", expect.objectContaining({ name: "Test" }));
  });

  it("updateById merges existing record so unpatched fields survive", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = createGenericRelationalService({
      repo: {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue({
          id: "rec-1",
          name: "Original",
          type: "Standard",
          status: "active",
        }),
        save,
      },
      schema: z.object({
        id: z.string(),
        name: z.string(),
        type: z.string().optional(),
        status: z.string(),
      }),
      websocketCollection: "records",
      idPrefix: "rec",
    });

    const updated = await runWithTenant("demo", () =>
      service.updateById("rec-1", { id: "rec-1", status: "completed" } as never),
    );

    expect(updated).toEqual({
      id: "rec-1",
      name: "Original",
      type: "Standard",
      status: "completed",
    });
    expect(save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        id: "rec-1",
        name: "Original",
        type: "Standard",
        status: "completed",
      }),
    );
  });

  it("bulkDeleteByIds deduplicates input IDs and ignores whitespace", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = createGenericRelationalService({
      repo: {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue({
          id: "rec-1",
          name: "Active",
        }),
        save,
      },
      schema: z.object({
        id: z.string(),
        name: z.string(),
        deletedAt: z.string().optional(),
        deletedBy: z.string().optional(),
        deletionReason: z.string().optional(),
      }),
      websocketCollection: "records",
      idPrefix: "rec",
    });

    const result = await runWithTenant("demo", () =>
      service.bulkDeleteByIds(["rec-1", " rec-1 ", "rec-1"], "user-admin"),
    );

    expect(result).toEqual({ succeeded: 1, failed: 0 });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
