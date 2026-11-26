import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listAllUserUiPreferencesByWorkspace,
  replaceUserUiPreferencesForWorkspace,
  type UserUiPreferenceRecord,
} from "../tenant/repository/db/userUiPreferencesRepository.js";
import { withTenant, type TenantTransaction } from "@mms/db/context";

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: vi.fn(
    async (_tenant: string | null | undefined, cb: (tx: TenantTransaction) => Promise<unknown>) => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn(),
      } as unknown as TenantTransaction;
      return cb(mockTx);
    },
  ),
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

    vi.mocked(withTenant).mockImplementationOnce(
      async (
        _tenant: string | null | undefined,
        cb: (tx: TenantTransaction) => Promise<unknown>,
      ) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockRows),
            }),
          }),
        } as unknown as TenantTransaction;
        return (await cb(mockTx)) as never;
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
    const insertedValues: UserUiPreferenceRecord[] = [];

    vi.mocked(withTenant).mockImplementationOnce(
      async (
        _tenant: string | null | undefined,
        cb: (tx: TenantTransaction) => Promise<unknown>,
      ) => {
        const mockTx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: "u-1" }]),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi
              .fn()
              .mockImplementation((val: UserUiPreferenceRecord | UserUiPreferenceRecord[]) => {
                if (Array.isArray(val)) {
                  insertedValues.push(...val);
                } else {
                  insertedValues.push(val);
                }
                return Promise.resolve();
              }),
          }),
        } as unknown as TenantTransaction;
        return (await cb(mockTx)) as never;
      },
    );

    await replaceUserUiPreferencesForWorkspace("demo", [
      { userId: "u-1", state: { mode: "table" } },
      { userId: "u-orphaned", state: { mode: "cards" } },
    ]);

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]?.userId).toBe("u-1");
    expect(insertedValues[0]?.state).toEqual({ mode: "table" });
  });
});
