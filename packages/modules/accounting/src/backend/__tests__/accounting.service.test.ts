import { describe, expect, it, vi } from "vitest";
import { createAccountingService } from "../accounting.service.js";
import type { AccountingPorts } from "../ports.js";

const ctx = { tenantId: "demo", actorId: "u1", actorRole: "accountant", requestId: "req" };

function ports(): AccountingPorts {
  return {
    tenant: {
      listAccounts: vi.fn(async () => []),
      listJournalEntries: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      })),
      saveJournalEntry: vi.fn(async (_ctx, entry) => entry),
      reverseJournalEntry: vi.fn(
        async (_ctx, _id, reason) => ({ id: "reversal", ref: reason }) as never,
      ),
      listFiscalYears: vi.fn(async () => []),
      closeFiscalYear: vi.fn(async (_ctx, id) => ({ id, status: "closed" }) as never),
      buildTrialBalance: vi.fn(async () => []),
    },
    platform: {
      listConsolidationGroups: vi.fn(async () => []),
      saveConsolidationGroup: vi.fn(async (_id, input) => ({ id: "g", ...input }) as never),
      deleteConsolidationGroup: vi.fn(async () => true),
      buildConsolidationReport: vi.fn(async () => ({}) as never),
      insertPlatformActivity: vi.fn(async () => undefined),
    },
  };
}

describe("AccountingService", () => {
  it("requires an actor and tenant context", async () => {
    const service = createAccountingService(ports());
    await expect(service.listAccounts({ ...ctx, tenantId: "" })).rejects.toThrow(/tenant/);
    await expect(service.listAccounts({ ...ctx, actorId: "" })).rejects.toThrow(/actor/);
  });

  it("clamps journal page size", async () => {
    const p = ports();
    const service = createAccountingService(p);
    await service.listJournalEntries(ctx, { page: 1, limit: 5000 });
    expect(p.tenant.listJournalEntries).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ limit: 200 }),
    );
  });

  it("requires a reversal reason", async () => {
    const service = createAccountingService(ports());
    await expect(service.reverseJournalEntry(ctx, "e1", "no")).rejects.toThrow(/reason/);
  });

  it("audits platform consolidation mutations", async () => {
    const p = ports();
    const service = createAccountingService(p);
    await service.saveConsolidationGroup({ id: "p1", email: "op@example.com" }, "group-1", {
      name: "Group",
      presentationCurrency: "USD",
      members: [],
      intercompanyAccountCodes: [],
    });
    expect(p.platform.insertPlatformActivity).toHaveBeenCalled();
  });
});
