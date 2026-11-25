import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    deletedRows: [] as Array<{ id: string }>,
    selectCalls: [] as unknown[][],
    mockRows: [] as Array<{
      id: string;
      workspaceSubdomain: string;
      label: string;
      labelKey: string | null;
      body: string;
      category: string;
      channel: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
  },
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      delete: () => ({
        where: () => ({ returning: async () => state.deletedRows }),
      }),
      select: () => ({
        from: () => ({
          where: async (_cond: unknown) => {
            state.selectCalls.push(state.mockRows);
            return state.mockRows;
          },
        }),
      }),
    }),
}));

import {
  deleteMessageTemplateById,
  findMessageTemplatesByIds,
} from "../repository/db/messagingTemplatesRepository.js";

describe("deleteMessageTemplateById", () => {
  beforeEach(() => {
    state.deletedRows = [];
    state.selectCalls = [];
    state.mockRows = [];
  });

  it("reports false when no row matched, true when one was removed", async () => {
    // A concurrent delete between the handler's existence check and the DELETE
    // must not be reported as success.
    await expect(deleteMessageTemplateById("demo", "custom_missing")).resolves.toBe(false);

    state.deletedRows = [{ id: "custom_existing" }];
    await expect(deleteMessageTemplateById("demo", "custom_existing")).resolves.toBe(true);
  });

  it("returns false without querying when the id is blank", async () => {
    await expect(deleteMessageTemplateById("demo", "   ")).resolves.toBe(false);
  });
});

describe("findMessageTemplatesByIds", () => {
  beforeEach(() => {
    state.deletedRows = [];
    state.selectCalls = [];
    state.mockRows = [];
  });

  it("returns empty array when given empty or whitespace-only ids", async () => {
    await expect(findMessageTemplatesByIds("demo", [])).resolves.toEqual([]);
    await expect(findMessageTemplatesByIds("demo", ["", "   "])).resolves.toEqual([]);
    expect(state.selectCalls).toHaveLength(0);
  });

  it("chunks queries into batches of 250 when querying many ids", async () => {
    const ids = Array.from({ length: 550 }, (_, i) => `tpl_${i}`);
    await findMessageTemplatesByIds("demo", ids);
    // 550 items with 250 batch size should produce ceil(550/250) = 3 select queries
    expect(state.selectCalls).toHaveLength(3);
  });
});
