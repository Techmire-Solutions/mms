import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  importBatch: undefined as
    ((rows: unknown[], ctx: Record<string, unknown>) => Promise<unknown>) | undefined,
  listObligationTypesByWorkspace: vi.fn(),
  listMujtahidRepsByWorkspace: vi.fn(),
  loadContactsPage: vi.fn(),
  createObligationCollection: vi.fn(),
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (o: { importBatch: unknown }) => {
    h.importBatch = o.importBatch as typeof h.importBatch;
  },
}));
vi.mock("../obligations/repository/obligationsRepositoryAdapter.js", () => ({
  obligationsRepository: {
    listObligationTypesByWorkspace: h.listObligationTypesByWorkspace,
    listMujtahidRepsByWorkspace: h.listMujtahidRepsByWorkspace,
  },
}));
vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactsPage: h.loadContactsPage,
}));
vi.mock("../obligations/use-cases/obligationsUseCases.js", () => ({
  obligationsUseCases: { createObligationCollection: h.createObligationCollection },
}));

import { registerObligationsImportJobRunner } from "../services/backgroundJobObligationsRunners.js";

describe("obligations import runner", () => {
  beforeEach(() => {
    h.listObligationTypesByWorkspace.mockReset().mockResolvedValue([{ id: "t1", name: "Zakat" }]);
    h.listMujtahidRepsByWorkspace
      .mockReset()
      .mockResolvedValue([{ id: "r1", name: "Sayyid Ja'far" }]);
    h.loadContactsPage
      .mockReset()
      .mockResolvedValue({ contacts: [{ id: "c1", name: "Haji Ghulam" }] });
    h.createObligationCollection.mockReset().mockResolvedValue({});
  });

  it("resolves type/representative/donor names to ids and reports unresolved rows", async () => {
    registerObligationsImportJobRunner();

    const result = (await h.importBatch!(
      [
        {
          receiptNo: "OB-1",
          receivedDate: "2026-10-24",
          donorName: "Haji Ghulam",
          representative: "Sayyid Ja'far",
          obligationType: "Zakat",
          amount: "5000.00",
          currency: "PKR",
        },
        {
          receiptNo: "OB-2",
          receivedDate: "2026-10-24",
          donorName: "Missing Donor",
          representative: "Sayyid Ja'far",
          obligationType: "Zakat",
        },
      ],
      {
        tenant: "demo",
        userId: "u1",
        jobId: "job-1",
        viewerRole: "admin",
        updateProgress: vi.fn().mockResolvedValue(undefined),
      },
    )) as { imported: number; failed: number; errors?: Array<{ row: number; reason: string }> };

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors?.[0]).toMatchObject({
      row: 2,
      reason: expect.stringContaining("Missing Donor"),
    });
    expect(h.createObligationCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        receipt_no: "OB-1",
        sender_id: "c1",
        obligation_type_id: "t1",
        mujtahid_representative_id: "r1",
      }),
    );
  });
});
