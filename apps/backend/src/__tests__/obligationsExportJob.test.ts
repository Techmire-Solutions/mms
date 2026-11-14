import { describe, expect, it, vi } from "vitest";

/**
 * The obligations export route advertises Export but answered 503 because no
 * `obligations:export` runner was registered (`hasBackgroundJobRunner` is process-local). These
 * tests pin the registration and the CSV the runner produces.
 */

const mockRepo = vi.hoisted(() => ({
  listObligationCollectionsByWorkspace: vi.fn(),
  listObligationTypesByWorkspace: vi.fn(),
  listMujtahidRepsByWorkspace: vi.fn(),
}));

vi.mock("../obligations/repository/obligationsRepositoryAdapter.js", () => ({
  obligationsRepository: mockRepo,
}));

import { hasBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import { registerObligationsJobRunners } from "../services/backgroundJobObligationsRunners.js";
import {
  buildObligationsCsvExport,
  MAX_OBLIGATIONS_EXPORT_ROWS,
} from "../services/obligationsExportService.js";

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    id: "oc-1",
    receipt_no: "REC-1",
    received_date: "2026-06-15",
    sender_id: "cnt-1",
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
    amount: 1500.25,
    currency_id: "PKR",
    payment_mode: "Cash",
    reference_id: "REF-9",
    received_by: "Sadat",
    ...overrides,
  };
}

describe("obligations export job", () => {
  it("registers a runner the route can see", () => {
    expect(hasBackgroundJobRunner("obligations:export")).toBe(false);
    registerObligationsJobRunners();
    expect(hasBackgroundJobRunner("obligations:export")).toBe(true);
  });

  it("emits a header and one row per receipt with ids resolved to names", async () => {
    mockRepo.listObligationTypesByWorkspace.mockResolvedValue([{ id: "ot-1", name: "Khums" }]);
    mockRepo.listMujtahidRepsByWorkspace.mockResolvedValue([{ id: "rep-1", name: "Rep Sadat" }]);
    mockRepo.listObligationCollectionsByWorkspace.mockResolvedValue([receipt()]);

    const result = await buildObligationsCsvExport({}, { viewerRole: "accountant" }, "demo");

    const [header, row] = result.csv.split("\n");
    expect(header).toContain("Receipt No");
    expect(header).toContain("Amount");
    expect(row).toContain("REC-1");
    expect(row).toContain("Khums");
    expect(row).toContain("Rep Sadat");
    expect(row).toContain("1500.25");
    expect(result.count).toBe(1);
    expect(result.filename).toContain("obligations-export.csv");
  });

  it("exports the archive only when the request asks for it *and* the role may", async () => {
    mockRepo.listObligationTypesByWorkspace.mockResolvedValue([]);
    mockRepo.listMujtahidRepsByWorkspace.mockResolvedValue([]);
    mockRepo.listObligationCollectionsByWorkspace.mockResolvedValue([
      receipt({ deleted_at: "2026-07-01T00:00:00.000Z", deletion_reason: "Duplicate" }),
    ]);

    // Permission alone does not include the trash: the request decides.
    await buildObligationsCsvExport({}, { allowDeleted: true }, "demo");
    expect(mockRepo.listObligationCollectionsByWorkspace).toHaveBeenLastCalledWith(
      "demo",
      expect.objectContaining({ deleted: "active" }),
    );

    // Both together read `all` — an archive export still contains the live receipts.
    const archived = await buildObligationsCsvExport(
      { includeDeleted: true },
      { allowDeleted: true },
      "demo",
    );
    expect(mockRepo.listObligationCollectionsByWorkspace).toHaveBeenLastCalledWith(
      "demo",
      expect.objectContaining({ deleted: "all" }),
    );
    expect(archived.csv).toContain("Deletion Reason");
    expect(archived.csv).toContain("Duplicate");

    const plain = await buildObligationsCsvExport({}, {}, "demo");
    expect(plain.csv).not.toContain("Deletion Reason");
  });

  it("ignores includeDeleted from an unauthorised caller", () => {
    // The route strips the field for a role without trash access; the builder must not trust it
    // anyway, or a crafted job payload could export archived receipts to a reader.
    mockRepo.listObligationTypesByWorkspace.mockResolvedValue([]);
    mockRepo.listMujtahidRepsByWorkspace.mockResolvedValue([]);
    mockRepo.listObligationCollectionsByWorkspace.mockResolvedValue([]);

    return buildObligationsCsvExport({ includeDeleted: true }, {}, "demo").then(() => {
      expect(mockRepo.listObligationCollectionsByWorkspace).toHaveBeenLastCalledWith(
        "demo",
        expect.objectContaining({ deleted: "active" }),
      );
    });
  });

  it("pages the repository instead of trusting a single capped read", async () => {
    mockRepo.listObligationTypesByWorkspace.mockResolvedValue([]);
    mockRepo.listMujtahidRepsByWorkspace.mockResolvedValue([]);
    mockRepo.listObligationCollectionsByWorkspace
      .mockResolvedValueOnce(
        Array.from({ length: 1000 }, (_unused, index) => receipt({ id: `oc-${index}` })),
      )
      .mockResolvedValueOnce([receipt({ id: "oc-last", receipt_no: "REC-LAST" })]);

    const result = await buildObligationsCsvExport({}, {}, "demo");

    expect(result.count).toBe(1001);
    expect(result.csv).toContain("REC-LAST");
    expect(mockRepo.listObligationCollectionsByWorkspace).toHaveBeenCalledTimes(2);
  });

  it("refuses an unbounded export instead of exhausting worker memory", async () => {
    mockRepo.listObligationTypesByWorkspace.mockResolvedValue([]);
    mockRepo.listMujtahidRepsByWorkspace.mockResolvedValue([]);
    mockRepo.listObligationCollectionsByWorkspace.mockImplementation(async () =>
      Array.from({ length: 1000 }, (_unused, index) => receipt({ id: `oc-${index}` })),
    );

    await expect(buildObligationsCsvExport({}, {}, "demo")).rejects.toMatchObject({
      statusCode: 413,
    });
    expect(MAX_OBLIGATIONS_EXPORT_ROWS).toBeGreaterThan(1000);
  });

  it("honours the abort signal a deadline passes in", async () => {
    mockRepo.listObligationTypesByWorkspace.mockResolvedValue([]);
    mockRepo.listMujtahidRepsByWorkspace.mockResolvedValue([]);
    const controller = new AbortController();
    controller.abort();

    await expect(buildObligationsCsvExport({}, {}, "demo", controller.signal)).rejects.toThrow(
      /aborted/i,
    );
  });
});
