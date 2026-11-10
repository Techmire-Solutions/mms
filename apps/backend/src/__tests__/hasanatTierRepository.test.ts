import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockTxState {
  selectQueue: unknown[][];
  executeResult: { rows?: Array<Record<string, unknown>> };
  insertedRows: unknown[];
  updatedRows: unknown[];
  lastValues: unknown[];
  lastUpdateSet: unknown;
}

const txState: MockTxState = {
  selectQueue: [],
  executeResult: { rows: [] },
  insertedRows: [],
  updatedRows: [],
  lastValues: [],
  lastUpdateSet: null,
};

const mockTx = {
  select: (_shape?: unknown) => ({
    from: (_table?: unknown) => {
      const exec = () => Promise.resolve(txState.selectQueue.shift() ?? []);
      return {
        where: (_condition?: unknown) => ({
          orderBy: () => exec(),
          then: (resolve: (v: unknown[]) => void) => exec().then(resolve),
        }),
        orderBy: () => exec(),
        then: (resolve: (v: unknown[]) => void) => exec().then(resolve),
      };
    },
  }),
  insert: (_table?: unknown) => ({
    values: (values: unknown[]) => {
      txState.lastValues = values;
      return {
        onConflictDoNothing: () => ({
          returning: async () => txState.insertedRows,
        }),
      };
    },
  }),
  update: (_table?: unknown) => ({
    set: (setData: unknown) => {
      txState.lastUpdateSet = setData;
      return {
        where: (_condition?: unknown) => ({
          returning: async () => txState.updatedRows,
        }),
      };
    },
  }),
  execute: vi.fn(async () => txState.executeResult),
};

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
  withTenantRead: async (_tenant: string, cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
}));

import {
  findStudentsForCards,
  getStudentPoints,
  insertStudentAwards,
  listLiveStudentAwards,
  listStudentAwards,
  listTenantTierState,
  revokeStudentAwards,
} from "../db/repositories/hasanatTierRepository.js";

describe("hasanatTierRepository", () => {
  const fixedNow = new Date("2026-11-10T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    txState.selectQueue = [];
    txState.executeResult = { rows: [] };
    txState.insertedRows = [];
    txState.updatedRows = [];
    txState.lastValues = [];
    txState.lastUpdateSet = null;
  });

  describe("getStudentPoints", () => {
    it("aggregates earned, balance, and redeemed points for a student", async () => {
      txState.selectQueue = [[{ earned: 150, balance: 100 }], [{ redeemed: 50 }]];

      const points = await getStudentPoints("demo", "stu-1");
      expect(points).toEqual({
        studentId: "stu-1",
        earned: 150,
        balance: 100,
        redeemed: 50,
      });
    });

    it("scopes points query by sessionId when provided and defaults missing rows to 0", async () => {
      txState.selectQueue = [[], []];

      const points = await getStudentPoints("demo", "stu-2", "sess-2026");
      expect(points).toEqual({
        studentId: "stu-2",
        earned: 0,
        balance: 0,
        redeemed: 0,
      });
    });
  });

  describe("listStudentAwards & listLiveStudentAwards", () => {
    it("returns formatted awards for a student, newest first", async () => {
      txState.selectQueue = [
        [
          {
            id: "aw-1",
            tierKey: "gold",
            tierName: "Gold",
            earnedSnapshot: 250,
            awardedAt: fixedNow,
            revokedAt: null,
            revokedReason: null,
          },
        ],
      ];

      const awards = await listStudentAwards("demo", "stu-1");
      expect(awards).toEqual([
        {
          id: "aw-1",
          tierKey: "gold",
          tierName: "Gold",
          earnedSnapshot: 250,
          awardedAt: fixedNow.toISOString(),
          revokedAt: null,
          revokedReason: null,
        },
      ]);
    });

    it("listLiveStudentAwards filters to non-revoked rows", async () => {
      txState.selectQueue = [
        [
          {
            id: "aw-2",
            tierKey: "silver",
            tierName: "Silver",
            earnedSnapshot: 100,
            awardedAt: fixedNow,
            revokedAt: null,
            revokedReason: null,
          },
        ],
      ];

      const live = await listLiveStudentAwards("demo", "stu-1");
      expect(live).toHaveLength(1);
      expect(live[0]?.tierKey).toBe("silver");
    });
  });

  describe("insertStudentAwards", () => {
    it("returns empty array immediately when no awards are provided", async () => {
      const res = await insertStudentAwards("demo", []);
      expect(res).toEqual([]);
      expect(txState.lastValues).toEqual([]);
    });

    it("inserts award rows with onConflictDoNothing and returns mapped results", async () => {
      txState.insertedRows = [
        {
          id: "aw-10",
          tierKey: "bronze",
          tierName: "Bronze",
          earnedSnapshot: 50,
          awardedAt: fixedNow,
          revokedAt: null,
          revokedReason: null,
        },
      ];

      const inserted = await insertStudentAwards("demo", [
        {
          studentId: "stu-1",
          tierKey: "bronze",
          tierName: "Bronze",
          earnedSnapshot: 50,
        },
      ]);

      expect(inserted).toHaveLength(1);
      expect(inserted[0]?.id).toBe("aw-10");
      expect(txState.lastValues).toHaveLength(1);
    });
  });

  describe("revokeStudentAwards", () => {
    it("returns 0 immediately when awardIds array is empty", async () => {
      const count = await revokeStudentAwards("demo", [], "test revoke");
      expect(count).toBe(0);
    });

    it("revokes specified awards and returns the revoked count", async () => {
      txState.updatedRows = [{ id: "aw-1" }, { id: "aw-2" }];

      const count = await revokeStudentAwards("demo", ["aw-1", "aw-2"], "Demoted");
      expect(count).toBe(2);
      expect(txState.lastUpdateSet).toMatchObject({ revokedReason: "Demoted" });
    });
  });

  describe("listTenantTierState", () => {
    it("executes state query with and without studentId filters", async () => {
      txState.executeResult = {
        rows: [
          {
            studentId: "stu-1",
            earned: 200,
            liveAwards: [{ id: "aw-1", tierKey: "silver" }],
          },
        ],
      };

      const resultAll = await listTenantTierState("demo");
      expect(resultAll).toHaveLength(1);
      expect(resultAll[0]?.studentId).toBe("stu-1");
      expect(resultAll[0]?.liveAwards).toEqual([{ id: "aw-1", tierKey: "silver" }]);

      const resultFiltered = await listTenantTierState("demo", ["stu-1"]);
      expect(resultFiltered).toHaveLength(1);
      expect(mockTx.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("findStudentsForCards", () => {
    it("returns empty array when cardIds is empty", async () => {
      const res = await findStudentsForCards("demo", []);
      expect(res).toEqual([]);
    });

    it("returns unique non-null studentIds for given cardIds", async () => {
      txState.selectQueue = [
        [{ studentId: "stu-1" }, { studentId: "stu-2" }, { studentId: "stu-1" }],
      ];

      const studentIds = await findStudentsForCards("demo", ["c-1", "c-2", "c-3"]);
      expect(studentIds).toEqual(["stu-1", "stu-2"]);
    });
  });
});
