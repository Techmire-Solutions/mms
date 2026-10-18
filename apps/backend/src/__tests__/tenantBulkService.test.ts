import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { scopeDeleted, upsertWithBroadcast } from "../services/tenantBulkService.js";

const bulkSave = vi.fn();
const broadcastCollection = vi.fn();

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => broadcastCollection(...args),
}));

describe("tenantBulkService helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopeDeleted separates active and trash rows", async () => {
    const rows = [
      { id: "1", deletedAt: null },
      { id: "2", deletedAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(scopeDeleted(rows, false).map((row) => row.id)).toEqual(["1"]);
    expect(scopeDeleted(rows, true).map((row) => row.id)).toEqual(["2"]);
  });

  it("upsertWithBroadcast bulk-saves without replace", async () => {
    const schema = { parse: (data: unknown) => data as Array<{ id: string }> };
    const result = await runWithTenant("demo", () =>
      upsertWithBroadcast(schema, [{ id: "1" }], bulkSave, "students"),
    );
    expect(result).toEqual([{ id: "1" }]);
    expect(bulkSave).toHaveBeenCalledWith("demo", [{ id: "1" }]);
    expect(broadcastCollection).toHaveBeenCalledWith("students");
  });
});
