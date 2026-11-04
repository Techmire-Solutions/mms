import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    deletedRows: [] as Array<{ id: string }>,
  },
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      delete: () => ({
        where: () => ({ returning: async () => state.deletedRows }),
      }),
    }),
}));

import { deleteMessageTemplateById } from "../db/repositories/messagingTemplatesRepository.js";

describe("deleteMessageTemplateById", () => {
  beforeEach(() => {
    state.deletedRows = [];
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
