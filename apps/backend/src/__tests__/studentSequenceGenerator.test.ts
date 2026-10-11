import { describe, expect, it, vi } from "vitest";
import {
  generateNextGrNumberSql,
  generateNextGrNumberBatchSql,
  previewNextGrNumberSql,
} from "../db/repositories/studentRepositorySequence.js";
import { syncStudentEnrolledSessionsTx } from "../db/repositories/studentRepositoryEnrollOps.js";
import type { AppDb } from "../db/tenant-context.js";

function createFakeSequenceTx(initialSeq: number, initialYear: number) {
  let storedSeq = initialSeq;
  let storedYear = initialYear;
  const fakeTx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const rows = [{ currentSequence: storedSeq, lastYear: storedYear }];
          return Object.assign(Promise.resolve(rows), {
            for: vi.fn().mockImplementation(() => Promise.resolve(rows)),
          });
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((payload: { currentSequence: number; lastYear: number }) => {
        storedSeq = payload.currentSequence;
        storedYear = payload.lastYear;
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    }),
  };
  return { fakeTx, getStored: () => ({ storedSeq, storedYear }) };
}

describe("studentSequenceGenerator", () => {
  it("formats next sequence and increments sequence with annual rollover", async () => {
    const { fakeTx, getStored } = createFakeSequenceTx(10, 2026);

    const gr = await generateNextGrNumberSql(
      "demo",
      {
        regDate: "2026-08-10",
        settings: {
          grNumberTemplate: "GR-{seq}/{year}",
          grNumberDigits: 4,
          grNumberRestartAnnually: true,
        },
      },
      fakeTx as unknown as Parameters<typeof generateNextGrNumberSql>[2],
    );

    expect(gr).toBe("GR-0011/2026");
    expect(getStored()).toEqual({ storedSeq: 11, storedYear: 2026 });
  });

  it("resets sequence to 1 when year changes and annual restart is enabled", async () => {
    const { fakeTx, getStored } = createFakeSequenceTx(50, 2025);

    const gr = await generateNextGrNumberSql(
      "demo",
      {
        regDate: "2026-01-15",
        settings: {
          grNumberTemplate: "{year}-{seq}",
          grNumberDigits: 3,
          grNumberRestartAnnually: true,
        },
      },
      fakeTx as unknown as Parameters<typeof generateNextGrNumberSql>[2],
    );

    expect(gr).toBe("2026-001");
    expect(getStored()).toEqual({ storedSeq: 1, storedYear: 2026 });
  });

  it("generates a batch of sequence numbers atomically in a single operation", async () => {
    const { fakeTx, getStored } = createFakeSequenceTx(5, 2026);

    const grs = await generateNextGrNumberBatchSql(
      "demo",
      3,
      {
        regDate: "2026-08-10",
        settings: {
          grNumberTemplate: "GR-{seq}/{year}",
          grNumberDigits: 4,
          grNumberRestartAnnually: true,
        },
      },
      fakeTx as unknown as Parameters<typeof generateNextGrNumberBatchSql>[3],
    );

    expect(grs).toEqual(["GR-0006/2026", "GR-0007/2026", "GR-0008/2026"]);
    expect(getStored()).toEqual({ storedSeq: 8, storedYear: 2026 });
  });

  it("previews next sequence without mutating sequence configuration", async () => {
    const { fakeTx, getStored } = createFakeSequenceTx(10, 2026);
    const gr = await previewNextGrNumberSql(
      "demo",
      {
        regDate: "2026-08-10",
        settings: {
          grNumberTemplate: "GR-{seq}/{year}",
          grNumberDigits: 4,
          grNumberRestartAnnually: true,
        },
      },
      fakeTx as unknown as Parameters<typeof previewNextGrNumberSql>[2],
    );

    expect(gr).toBe("GR-0011/2026");
    expect(getStored()).toEqual({ storedSeq: 10, storedYear: 2026 });
    expect(fakeTx.update).not.toHaveBeenCalled();
  });
});

describe("syncStudentEnrolledSessionsTx", () => {
  it("skips delete and insert when existing enrolled sessions match input", async () => {
    const deleteFn = vi.fn();
    const insertFn = vi.fn();

    const fakeTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ sessionId: "sess-1" }, { sessionId: "sess-2" }]),
        }),
      }),
      delete: deleteFn,
      insert: insertFn,
    };

    await syncStudentEnrolledSessionsTx(fakeTx as unknown as AppDb, "demo", "stu-1", [
      "sess-1",
      "sess-2",
    ]);

    expect(deleteFn).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("deletes and re-inserts when enrolled sessions differ", async () => {
    const deleteWhere = vi.fn().mockResolvedValue([]);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
    const insertValues = vi.fn().mockResolvedValue([]);
    const insertFn = vi.fn().mockReturnValue({ values: insertValues });

    const fakeTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ sessionId: "sess-1" }]),
        }),
      }),
      delete: deleteFn,
      insert: insertFn,
    };

    await syncStudentEnrolledSessionsTx(fakeTx as unknown as AppDb, "demo", "stu-1", [
      "sess-1",
      "sess-2",
    ]);

    expect(deleteFn).toHaveBeenCalled();
    expect(insertFn).toHaveBeenCalled();
  });
});
