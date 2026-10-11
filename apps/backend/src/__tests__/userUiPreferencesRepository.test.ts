import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listAllUserUiPreferencesByWorkspace,
  replaceUserUiPreferencesForWorkspace,
} from "../db/repositories/userUiPreferencesRepository.js";
import { withTenant } from "../db/tenant-context.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn(async (_tenant: string, cb: (tx: any) => Promise<unknown>) => {
    const mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn(),
    };
    return cb(mockTx);
  }),
}));

describe("userUiPreferencesRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists user UI preferences formatted as records", async () => {
    const mockRows = [
      {
        userId: "u-1",
        state: { columns: { name: { visible: true, width: 200 } } },
        updatedAt: new Date("2026-08-27T00:00:00.000Z"),
      },
    ];

    (withTenant as any).mockImplementationOnce(
      async (_tenant: string, cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockRows),
            }),
          }),
        };
        return cb(mockTx);
      },
    );

    const result = await listAllUserUiPreferencesByWorkspace("demo");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      userId: "u-1",
      state: { columns: { name: { visible: true, width: 200 } } },
      updatedAt: "2026-08-27T00:00:00.000Z",
    });
  });

  it("replaces user UI preferences filtering out orphaned users", async () => {
    const insertedValues: any[] = [];

    (withTenant as any).mockImplementationOnce(
      async (_tenant: string, cb: (tx: any) => Promise<unknown>) => {
        const mockTx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: "u-1" }]), // Only u-1 exists
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              if (Array.isArray(val)) {
                insertedValues.push(...val);
              } else {
                insertedValues.push(val);
              }
              return Promise.resolve();
            }),
          }),
        };
        return cb(mockTx);
      },
    );

    await replaceUserUiPreferencesForWorkspace("demo", [
      { userId: "u-1", state: { mode: "table" } },
      { userId: "u-orphaned", state: { mode: "cards" } },
    ]);

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0].userId).toBe("u-1");
    expect(insertedValues[0].state).toEqual({ mode: "table" });
  });
});
