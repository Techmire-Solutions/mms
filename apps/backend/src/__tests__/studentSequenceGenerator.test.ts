import { describe, expect, it, vi } from "vitest";
import {
  generateNextGrNumberSql,
  generateNextGrNumberBatchSql,
  previewNextGrNumberSql,
} from "../db/repositories/studentRepositorySequence.js";

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
