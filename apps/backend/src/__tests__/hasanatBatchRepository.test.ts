import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockTxState {
  selectQueue: unknown[][];
  executeResult: { rows?: Array<Record<string, unknown>> };
  insertedRows: unknown[];
  lastValues: unknown[];
}

const txState: MockTxState = {
  selectQueue: [],
  executeResult: { rows: [] },
  insertedRows: [],
  lastValues: [],
};

const mockTx = {
  select: (_shape?: unknown) => ({
    from: (_table?: unknown) => {
      const exec = () => Promise.resolve(txState.selectQueue.shift() ?? []);
      return {
        where: (_condition?: unknown) => ({
          then: (resolve: (v: unknown[]) => void) => exec().then(resolve),
        }),
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
  execute: vi.fn(async () => txState.executeResult),
};

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
  withTenantRead: async (_tenant: string, cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
}));

import {
  findDistributionsByClientRequestIds,
  findStudentsByNames,
  insertBatchDistributions,
  listBatchRecipients,
  type NewBatchCard,
} from "../db/repositories/hasanatBatchRepository.js";

describe("hasanatBatchRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txState.selectQueue = [];
    txState.executeResult = { rows: [] };
    txState.insertedRows = [];
    txState.lastValues = [];
  });

  describe("listBatchRecipients", () => {
    it("resolves students target recipients via sql query", async () => {
      txState.executeResult = {
        rows: [
          {
            studentId: "stu-1",
            studentName: "Ahmad",
            classId: "cls-1",
            sectionId: "sec-1",
            sessionId: "sess-1",
          },
        ],
      };

      const recipients = await listBatchRecipients("demo", {
        kind: "students",
        studentIds: ["stu-1", "stu-1"],
      });

      expect(recipients).toHaveLength(1);
      expect(recipients[0]).toEqual({
        studentId: "stu-1",
        studentName: "Ahmad",
        classId: "cls-1",
        sectionId: "sec-1",
        sessionId: "sess-1",
      });
      expect(mockTx.execute).toHaveBeenCalledTimes(1);
    });

    it("resolves class target recipients without sectionId", async () => {
      txState.executeResult = {
        rows: [
          {
            studentId: "stu-2",
            studentName: "Fatima",
            classId: "cls-2",
            sectionId: null,
            sessionId: "sess-2",
          },
        ],
      };

      const recipients = await listBatchRecipients("demo", {
        kind: "class",
        sessionId: "sess-2",
        classId: "cls-2",
      });

      expect(recipients).toHaveLength(1);
      expect(recipients[0]?.studentName).toBe("Fatima");
    });
  });

  describe("insertBatchDistributions", () => {
    it("returns empty array immediately when cards array is empty", async () => {
      const res = await insertBatchDistributions("demo", []);
      expect(res).toEqual([]);
      expect(txState.lastValues).toEqual([]);
    });

    it("inserts batch cards with onConflictDoNothing and validates date formats", async () => {
      txState.insertedRows = [{ id: "dist-1" }];

      const card: NewBatchCard = {
        id: "dist-1",
        studentId: "stu-1",
        studentName: "Ahmad",
        classId: "cls-1",
        sessionId: "sess-1",
        batchId: "batch-1",
        denominationId: "den-1",
        denominationName: "10 Points",
        quantity: 1,
        pointsSnapshot: 10,
        clientRequestId: "req-1",
        expiresOn: "2027-11-10",
        reason: "Excellence",
        issuedDate: "2026-11-10",
        issuedByUserId: "usr-1",
        issuedBy: "Admin",
      };

      const ids = await insertBatchDistributions("demo", [card]);
      expect(ids).toEqual(["dist-1"]);
      expect(txState.lastValues).toHaveLength(1);
    });

    it("handles cards with null expiresOn", async () => {
      txState.insertedRows = [{ id: "dist-2" }];

      const card: NewBatchCard = {
        id: "dist-2",
        studentId: "stu-2",
        studentName: "Fatima",
        classId: null,
        sessionId: null,
        batchId: "batch-2",
        denominationId: "den-2",
        denominationName: "20 Points",
        quantity: 1,
        pointsSnapshot: 20,
        clientRequestId: "req-2",
        expiresOn: null,
        reason: "Honesty",
        issuedDate: "2026-11-10",
        issuedByUserId: null,
        issuedBy: null,
      };

      const ids = await insertBatchDistributions("demo", [card]);
      expect(ids).toEqual(["dist-2"]);
    });
  });

  describe("findDistributionsByClientRequestIds", () => {
    it("returns empty array when request ids list is empty", async () => {
      const res = await findDistributionsByClientRequestIds("demo", []);
      expect(res).toEqual([]);
    });

    it("finds matching distributions by client request ids", async () => {
      txState.selectQueue = [
        [
          {
            id: "dist-1",
            clientRequestId: "req-1",
            studentId: "stu-1",
          },
        ],
      ];

      const found = await findDistributionsByClientRequestIds("demo", ["req-1"]);
      expect(found).toEqual([
        {
          id: "dist-1",
          clientRequestId: "req-1",
          studentId: "stu-1",
        },
      ]);
    });
  });

  describe("findStudentsByNames", () => {
    it("returns empty array when names list is empty or whitespace-only", async () => {
      const res = await findStudentsByNames("demo", ["", "   "]);
      expect(res).toEqual([]);
    });

    it("finds students by contact names using chunked query", async () => {
      txState.executeResult = {
        rows: [{ studentId: "stu-1", studentName: "Ahmad Ali" }],
      };

      const rows = await findStudentsByNames("demo", ["Ahmad Ali"]);
      expect(rows).toEqual([{ studentId: "stu-1", studentName: "Ahmad Ali" }]);
    });
  });
});
