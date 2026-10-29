import { describe, expect, it, vi } from "vitest";
import { createAccountingUseCases } from "../accounting/use-cases/accountingUseCases.js";
import type { AccountingRepository } from "../accounting/repository/accountingRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const mockRecordModernAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mockRecordModernAuditEvent,
}));

function createFakeRepo(): AccountingRepository {
  return {
    lockJournalEntries: vi.fn().mockResolvedValue(undefined),
    listAccountsByWorkspace: vi.fn().mockResolvedValue([]),
    findAccountById: vi.fn().mockResolvedValue(null),
    findAccountsByIds: vi.fn().mockResolvedValue([]),
    saveAccount: vi.fn().mockResolvedValue(undefined),
    bulkSaveAccounts: vi.fn().mockResolvedValue(undefined),
    replaceAccountsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listAccountsPage: vi.fn().mockResolvedValue({
      accounts: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    listEntriesByWorkspace: vi.fn().mockResolvedValue([]),
    findEntryById: vi.fn().mockResolvedValue(null),
    findEntriesByIds: vi.fn().mockResolvedValue([]),
    findEntryByRef: vi.fn().mockResolvedValue(null),
    findActiveEntryRefs: vi.fn().mockResolvedValue(new Set()),
    allocateVoucherNumbers: vi.fn(async (_tenant: string, options: { count?: number }) =>
      Array.from(
        { length: options.count ?? 1 },
        (_, index) => `JE-${String(index + 1).padStart(4, "0")}`,
      ),
    ),
    saveEntry: vi.fn().mockResolvedValue(undefined),
    bulkSaveEntries: vi.fn().mockResolvedValue(undefined),
    replaceEntriesForWorkspace: vi.fn().mockResolvedValue(undefined),
    listEntriesPage: vi.fn().mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    listFiscalYearsByWorkspace: vi.fn().mockResolvedValue([]),
    findFiscalYearById: vi.fn().mockResolvedValue(null),
    findFiscalYearsByIds: vi.fn().mockResolvedValue([]),
    saveFiscalYear: vi.fn().mockResolvedValue(undefined),
    bulkSaveFiscalYears: vi.fn().mockResolvedValue(undefined),
    replaceFiscalYearsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listFiscalYearsPage: vi.fn().mockResolvedValue({
      fiscalYears: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    aggregateAccountingCommandMetrics: vi.fn().mockResolvedValue({
      totalEntries: 4,
      posted: 3,
      draft: 1,
      activeAccounts: 2,
      inactiveAccounts: 0,
      newThisPeriod: 1,
      postedVolume: 100,
      revenue: 60,
      expenses: 40,
      surplus: 20,
      assets: 0,
      liabilities: 0,
    }),
    aggregateAccountingReport: vi.fn().mockResolvedValue({}),
  };
}

describe("accounting use-cases (DI with fake repository)", () => {
  it("loadAccountsPage delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createAccountingUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadAccountsPage({ page: 2, limit: 12 }),
    );

    expect(result).toEqual({ accounts: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listAccountsPage).toHaveBeenCalledWith("demo", { page: 2, limit: 12 });
  });

  it("loadAccountingCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createAccountingUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadAccountingCommandMetrics());

    expect(result.totalEntries).toBe(4);
    expect(repo.aggregateAccountingCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createAccountingUseCases(repo);

    const page = await useCases.loadAccountsPage({ page: 1, limit: 12 });
    const metrics = await useCases.loadAccountingCommandMetrics();

    expect(page).toEqual({ accounts: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(metrics.totalEntries).toBe(0);
    expect(repo.listAccountsPage).not.toHaveBeenCalled();
    expect(repo.aggregateAccountingCommandMetrics).not.toHaveBeenCalled();
  });

  it("loadAccountById and loadAccountsByIds delegate with soft-delete filtering", async () => {
    const activeAccount = {
      id: "acc_1",
      code: "1000",
      name: "Cash",
      type: "Asset" as const,
      subtype: "Current",
      description: "",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const deletedAccount = {
      ...activeAccount,
      id: "acc_2",
      deletedAt: "2026-01-02T00:00:00.000Z",
    };

    const repo = createFakeRepo();
    vi.mocked(repo.findAccountById).mockResolvedValue(deletedAccount);
    vi.mocked(repo.findAccountsByIds).mockImplementation(async (_tenant, ids, opts) => {
      const all = [activeAccount, deletedAccount].filter((a) => ids.includes(a.id));
      if (opts?.includeDeleted) return all.filter((a) => Boolean((a as any).deletedAt));
      return all.filter((a) => !(a as any).deletedAt);
    });
    const useCases = createAccountingUseCases(repo);

    await runWithTenant("demo", async () => {
      // Excludes deleted by default
      const res1 = await useCases.loadAccountById("acc_2");
      expect(res1).toBeNull();

      // Includes deleted when requested
      const res2 = await useCases.loadAccountById("acc_2", true);
      expect(res2?.id).toBe("acc_2");

      // Batch lookups with deduplication and filtering
      const batchRes = await useCases.loadAccountsByIds(["acc_1", "acc_2", "acc_1 "]);
      expect(batchRes).toHaveLength(1);
      expect(batchRes[0]?.id).toBe("acc_1");

      const batchArchived = await useCases.loadAccountsByIds(["acc_1", "acc_2"], true);
      expect(batchArchived).toHaveLength(1);
      expect(batchArchived[0]?.id).toBe("acc_2");
    });
  });

  it("loadEntryById and loadEntriesByIds delegate with soft-delete filtering", async () => {
    const activeEntry = {
      id: "je_1",
      date: "2026-01-01",
      ref: "REF-1",
      description: "Test entry",
      status: "posted" as const,
      created_by: "admin",
      fiscal_year: "2026",
      simple_mode: false,
      lines: [],
      tags: [],
      attachments: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const deletedEntry = {
      ...activeEntry,
      id: "je_2",
      deletedAt: "2026-01-02T00:00:00.000Z",
    };

    const repo = createFakeRepo();
    vi.mocked(repo.findEntryById).mockResolvedValue(deletedEntry);
    vi.mocked(repo.findEntriesByIds).mockImplementation(async (_tenant, ids, opts) => {
      const all = [activeEntry, deletedEntry].filter((e) => ids.includes(e.id));
      if (opts?.includeDeleted) return all.filter((e) => Boolean((e as any).deletedAt));
      return all.filter((e) => !(e as any).deletedAt);
    });
    const useCases = createAccountingUseCases(repo);

    await runWithTenant("demo", async () => {
      const res1 = await useCases.loadEntryById("je_2");
      expect(res1).toBeNull();

      const res2 = await useCases.loadEntryById("je_2", true);
      expect(res2?.id).toBe("je_2");

      const batchRes = await useCases.loadEntriesByIds(["je_1", "je_2"]);
      expect(batchRes).toHaveLength(1);
      expect(batchRes[0]?.id).toBe("je_1");
    });
  });

  it("loadFiscalYearById and loadFiscalYearsByIds delegate with soft-delete filtering", async () => {
    const activeYear = {
      id: "fy_1",
      label: "FY 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "upcoming" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const deletedYear = {
      ...activeYear,
      id: "fy_2",
      deletedAt: "2026-01-02T00:00:00.000Z",
    };

    const repo = createFakeRepo();
    vi.mocked(repo.findFiscalYearById).mockResolvedValue(deletedYear);
    vi.mocked(repo.findFiscalYearsByIds).mockImplementation(async (_tenant, ids, opts) => {
      const all = [activeYear, deletedYear].filter((f) => ids.includes(f.id));
      if (opts?.includeDeleted) return all.filter((f) => Boolean((f as any).deletedAt));
      return all.filter((f) => !(f as any).deletedAt);
    });
    const useCases = createAccountingUseCases(repo);

    await runWithTenant("demo", async () => {
      const res1 = await useCases.loadFiscalYearById("fy_2");
      expect(res1).toBeNull();

      const res2 = await useCases.loadFiscalYearById("fy_2", true);
      expect(res2?.id).toBe("fy_2");

      const batchRes = await useCases.loadFiscalYearsByIds(["fy_1", "fy_2"]);
      expect(batchRes).toHaveLength(1);
      expect(batchRes[0]?.id).toBe("fy_1");
    });
  });

  it("allows unchanged posted entries but rejects in-place edits of posted entries", async () => {
    const storedPosted = {
      id: "je_1",
      date: "2026-01-01",
      ref: "JE-0001",
      description: "Tuition",
      status: "posted" as const,
      created_by: "admin",
      fiscal_year: "FY 2026",
      simple_mode: false,
      tags: [],
      attachments: [],
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 100, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 100, description: "" },
      ],
    };

    const repo = createFakeRepo();
    vi.mocked(repo.findEntriesByIds).mockResolvedValue([storedPosted]);
    const useCases = createAccountingUseCases(repo);

    await runWithTenant("demo", async () => {
      await expect(useCases.upsertEntries([{ ...storedPosted }])).resolves.toHaveLength(1);

      const mutated = {
        ...storedPosted,
        lines: [
          { id: "l1", account_id: "acc_ar", debit: 999, credit: 0, description: "" },
          { id: "l2", account_id: "acc_income", debit: 0, credit: 999, description: "" },
        ],
      };
      await expect(useCases.upsertEntries([mutated])).rejects.toThrow("immutable");
    });
  });

  it("deleteAccountById blocks soft-deletion and throws 400 when account has active ledger entries", async () => {
    const repo = createFakeRepo();
    const countActiveJournalLinesForAccount = vi.fn().mockResolvedValue(3);
    const useCases = createAccountingUseCases(repo, { countActiveJournalLinesForAccount });

    await expect(
      runWithTenant("demo", () => useCases.deleteAccountById("acc_1", "user_1", "Testing")),
    ).rejects.toThrow("Cannot archive account with active ledger entries");
  });

  it("bulkSoftDeleteAccounts excludes accounts with active ledger entries", async () => {
    const repo = createFakeRepo();
    repo.bulkSoftDeleteAccounts = vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 });
    const countActiveJournalLinesForAccounts = vi.fn().mockResolvedValue(
      new Map([
        ["acc_1", 0],
        ["acc_2", 5], // has active lines, must be blocked
      ]),
    );
    const useCases = createAccountingUseCases(repo, { countActiveJournalLinesForAccounts });

    const result = await runWithTenant("demo", () =>
      useCases.bulkSoftDeleteAccounts(["acc_1", "acc_2"], "user_1"),
    );

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1); // acc_2 was blocked
  });
});

describe("accounting write guards", () => {
  const closedYear = {
    id: "fy-shut",
    label: "FY 2025",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "closed" as const,
  };
  const openYear = {
    id: "fy-open",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active" as const,
  };

  let entrySeq = 1;
  function postedEntry(overrides: Record<string, unknown> = {}) {
    const seq = entrySeq++;
    return {
      id: `je_${seq}`,
      date: "2026-03-01",
      ref: `JE-${String(seq).padStart(4, "0")}`,
      description: "Tuition",
      status: "posted" as const,
      created_by: "admin",
      fiscal_year: "FY 2026",
      fiscal_year_id: "fy-open",
      simple_mode: false,
      tags: [],
      attachments: [],
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 100, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 100, description: "" },
      ],
      ...overrides,
    };
  }

  /** The payload handed to the repository on the last bulk save. */
  function lastBulkSaved(repo: AccountingRepository): any[] {
    const calls = vi.mocked(repo.bulkSaveEntries).mock.calls;
    return (calls.at(-1)?.[1] as any[]) ?? [];
  }

  it("rejects a NEW posted entry dated inside a closed fiscal year", async () => {
    // Regression: the guard used to key off the declared fiscal-year reference
    // only, so a back-dated posting — or one stamped with the active year, which
    // is what the journal form produces — went straight in.
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear, closedYear] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertEntries([
          postedEntry({
            id: "je-backdated",
            date: "2025-06-15",
            fiscal_year: "FY 2026",
            fiscal_year_id: "fy-open",
          }) as any,
        ]),
      ),
    ).rejects.toThrow(/closed fiscal year/);
    expect(repo.bulkSaveEntries).not.toHaveBeenCalled();
  });

  it.each(["deletedAt", "deletedBy", "deletionReason"] as const)(
    "rejects fiscal-year lifecycle changes through bulk saves: %s",
    async (field) => {
      const repo = createFakeRepo();
      vi.mocked(repo.findFiscalYearsByIds).mockResolvedValue([closedYear]);
      const useCases = createAccountingUseCases(repo);
      await expect(
        runWithTenant("demo", () =>
          useCases.upsertFiscalYears([{ ...closedYear, [field]: "2026-01-01T00:00:00Z" }]),
        ),
      ).rejects.toThrow("lifecycle fields");
      expect(repo.bulkSaveFiscalYears).not.toHaveBeenCalled();
    },
  );

  it("returns an unchanged create replay without rewriting a posted journal", async () => {
    const repo = createFakeRepo();
    const stored = { ...postedEntry(), source_type: "manual" as const };
    vi.mocked(repo.findEntryById).mockResolvedValue(stored);
    const useCases = createAccountingUseCases(repo);
    const result = await runWithTenant("demo", () => useCases.createJournalEntry(stored));
    expect(result).toEqual(stored);
    expect(repo.saveEntry).not.toHaveBeenCalled();
    expect(repo.lockJournalEntries).toHaveBeenCalledWith("demo", [stored.id]);
  });

  it("rejects a salary create replay that changes the selected payment account", async () => {
    const repo = createFakeRepo();
    const stored = { ...postedEntry(), source_type: "manual" as const, transaction_type: "salary" };
    vi.mocked(repo.findEntryById).mockResolvedValue(stored);
    const useCases = createAccountingUseCases(repo);
    const changed = {
      ...stored,
      lines: stored.lines.map((line) => ({ ...line, account_id: "different-account" })),
    };
    await expect(
      runWithTenant("demo", () => useCases.createJournalEntry(changed)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.saveEntry).not.toHaveBeenCalled();
  });

  it("checks mutability after acquiring the journal lock", async () => {
    const repo = createFakeRepo();
    const posted = { ...postedEntry(), source_type: "manual" as const };
    vi.mocked(repo.findEntriesByIds).mockResolvedValue([{ ...posted, status: "draft" }]);
    vi.mocked(repo.lockJournalEntries).mockImplementation(async () => {
      // The competing writer committed a posting before this lock was granted.
      vi.mocked(repo.findEntriesByIds).mockResolvedValue([posted]);
    });
    const useCases = createAccountingUseCases(repo);
    await expect(
      runWithTenant("demo", () =>
        useCases.upsertEntries([{ ...posted, status: "draft", description: "stale draft save" }]),
      ),
    ).rejects.toThrow("immutable");
    expect(repo.bulkSaveEntries).not.toHaveBeenCalled();
  });

  it("still saves unchanged entries that belong to a closed fiscal year", async () => {
    // The Work tier re-sends the whole collection; rows whose fiscal year has
    // since closed must stay writable, otherwise any workspace that closes a year
    // can no longer save its journal at all.
    const stored = postedEntry({
      fiscal_year: "FY 2025",
      fiscal_year_id: "fy-shut",
      date: "2025-06-15",
    });
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear, closedYear] as any);
    vi.mocked(repo.findEntriesByIds).mockResolvedValue([stored] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([stored as any])),
    ).resolves.toHaveLength(1);
    expect(repo.bulkSaveEntries).toHaveBeenCalled();
  });

  it("rejects a new entry that references an unknown or archived account", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([{ id: "acc_ar" }] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([postedEntry({ id: "je_new" }) as any])),
    ).rejects.toThrow(/unknown, archived or deactivated accounts: acc_income/);
    expect(repo.bulkSaveEntries).not.toHaveBeenCalled();
  });

  it("rejects a new entry that references a deactivated account", async () => {
    // The chart-of-accounts UI's only "delete" sets isActive:false, and the
    // picker hides such accounts — so the write path must reject them too, or the
    // client and server disagree about what removal means.
    const repo = createFakeRepo();
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar", isActive: true },
      { id: "acc_income", isActive: false },
    ] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertEntries([postedEntry({ id: "je_inactive" }) as any]),
      ),
    ).rejects.toThrow(/unknown, archived or deactivated accounts: acc_income/);
    expect(repo.bulkSaveEntries).not.toHaveBeenCalled();
  });

  it("does not re-check accounts for unchanged rows", async () => {
    const stored = postedEntry({ id: "je_old" });
    const repo = createFakeRepo();
    vi.mocked(repo.findEntriesByIds).mockResolvedValue([stored] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([]); // account since archived
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([stored as any])),
    ).resolves.toHaveLength(1);
    expect(repo.findAccountsByIds).not.toHaveBeenCalled();
  });

  it("forces client-supplied source keys to manual and preserves stored ones", async () => {
    // source_type/source_id are the finance module's idempotency keys; a client
    // able to set them could pre-claim a source and suppress the real posting.
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    const storedSystemEntry = postedEntry({
      id: "je_system",
      source_type: "invoice",
      source_id: "inv-1",
    });
    vi.mocked(repo.findEntriesByIds).mockResolvedValue([storedSystemEntry] as any);
    const useCases = createAccountingUseCases(repo);

    await runWithTenant("demo", () =>
      useCases.upsertEntries([
        postedEntry({ id: "je_new", source_type: "closing", source_id: "forged" }) as any,
        { ...storedSystemEntry, source_type: "manual", source_id: undefined } as any,
      ]),
    );

    const saved = lastBulkSaved(repo);
    const fresh = saved.find((entry) => entry.id === "je_new");
    const existing = saved.find((entry) => entry.id === "je_system");
    expect(fresh.source_type).toBe("manual");
    expect(fresh.source_id).toBeUndefined();
    expect(existing.source_type).toBe("invoice");
    expect(existing.source_id).toBe("inv-1");
  });

  it("maps a unique violation on the entries insert to a 409 conflict, not a raw 500", async () => {
    // G2: the partial unique index accounting_entries_workspace_source_uidx
    // raises SQLSTATE 23505 when a write lands on an existing
    // (source_type, source_id) pair. The client must see a conflict, not the
    // unmapped database error surfacing as a 500.
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    const pgError = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "accounting_entries_workspace_source_uidx"',
      ),
      { code: "23505", constraint: "accounting_entries_workspace_source_uidx" },
    );
    vi.mocked(repo.bulkSaveEntries).mockRejectedValue(pgError);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([postedEntry({ id: "je_dup" }) as any])),
    ).rejects.toMatchObject({ statusCode: 409, type: "conflict" });
    expect(repo.bulkSaveEntries).toHaveBeenCalledTimes(1);
  });

  it("maps a driver-wrapped unique violation (cause chain) to a 409 conflict", async () => {
    // node-postgres wraps driver errors, hiding the 23505 code one level down
    // in `cause` — the probe must walk the chain like the real driver does.
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    const pgError = Object.assign(new Error("insert into accounting_entries failed"), {
      cause: Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
      }),
    });
    vi.mocked(repo.bulkSaveEntries).mockRejectedValue(pgError);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([postedEntry({ id: "je_dup" }) as any])),
    ).rejects.toMatchObject({ statusCode: 409, type: "conflict" });
  });

  it("does not map unrelated database errors to a conflict", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.bulkSaveEntries).mockRejectedValue(
      Object.assign(new Error("fk violated"), { code: "23503" }),
    );
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([postedEntry({ id: "je_fk" }) as any])),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      runWithTenant("demo", () => useCases.upsertEntries([postedEntry({ id: "je_fk" }) as any])),
    ).rejects.not.toMatchObject({ statusCode: 409 });
  });

  it("rejects reopening a closed fiscal year through the bulk collection route", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findFiscalYearsByIds).mockResolvedValue([closedYear] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertFiscalYears([{ ...closedYear, status: "active" } as any]),
      ),
    ).rejects.toThrow(/cannot be reopened/);
    expect(repo.bulkSaveFiscalYears).not.toHaveBeenCalled();
  });

  it("rejects changing the date range of a closed fiscal year", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findFiscalYearsByIds).mockResolvedValue([closedYear] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertFiscalYears([{ ...closedYear, endDate: "2026-06-30" } as any]),
      ),
    ).rejects.toThrow(/date range changed/);
  });

  it("rejects closing a fiscal year through the bulk collection route", async () => {
    // Closing must post the closing entry and require retained earnings; the
    // generic write would flip the switch the entire period lock depends on.
    const repo = createFakeRepo();
    vi.mocked(repo.findFiscalYearsByIds).mockResolvedValue([openYear] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertFiscalYears([{ ...openYear, status: "closed" } as any]),
      ),
    ).rejects.toThrow(/close-fiscal-year action/);
  });

  it("allows re-saving a closed fiscal year unchanged", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findFiscalYearsByIds).mockResolvedValue([closedYear] as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.upsertFiscalYears([{ ...closedYear } as any])),
    ).resolves.toHaveLength(1);
    expect(repo.bulkSaveFiscalYears).toHaveBeenCalled();
  });

  it("rejects a new fiscal year created directly as closed", async () => {
    const repo = createFakeRepo();
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertFiscalYears([{ ...openYear, id: "fy-brand-new", status: "closed" } as any]),
      ),
    ).rejects.toThrow(/close-fiscal-year action/);
  });
});

describe("journal entry reference uniqueness guards", () => {
  const openYear = {
    id: "fy-open",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active" as const,
  };

  it("createJournalEntry rejects a duplicate reference when an active entry already has that ref", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.findEntryByRef!).mockResolvedValue({ id: "je_existing", ref: "JE-0050" } as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.createJournalEntry({
          id: "je_new",
          date: "2026-03-01",
          ref: "JE-0050",
          description: "Payment",
          status: "draft",
          created_by: "admin",
          fiscal_year: "FY 2026",
          fiscal_year_id: "fy-open",
          simple_mode: false,
          tags: [],
          attachments: [],
          lines: [
            { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
            { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
          ],
        }),
      ),
    ).rejects.toThrow(/already exists/);
  });

  it("createJournalEntry requires a typed reference when automatic numbering is off", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.allocateVoucherNumbers!).mockResolvedValue(null);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.createJournalEntry({
          id: "je_manual",
          date: "2026-03-01",
          ref: "",
          description: "Manual numbering",
          status: "draft",
          created_by: "admin",
          fiscal_year: "FY 2026",
          fiscal_year_id: "fy-open",
          simple_mode: false,
          tags: [],
          attachments: [],
          lines: [],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("createJournalEntry allocates next sequential reference if ref is omitted", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.allocateVoucherNumbers!).mockResolvedValue(["JE-0099"]);
    const useCases = createAccountingUseCases(repo);

    const created = await runWithTenant("demo", () =>
      useCases.createJournalEntry({
        id: "je_new",
        date: "2026-03-01",
        ref: "",
        description: "Auto-ref",
        status: "draft",
        created_by: "admin",
        fiscal_year: "FY 2026",
        fiscal_year_id: "fy-open",
        simple_mode: false,
        tags: [],
        attachments: [],
        lines: [
          { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
          { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
        ],
      }),
    );

    expect(created.ref).toBe("JE-0099");
    expect(repo.allocateVoucherNumbers).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ date: "2026-03-01", count: 1 }),
    );
  });

  it("updateJournalEntryById rejects update when changed ref conflicts with another active entry", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.findEntryById).mockResolvedValue({
      id: "je_1",
      date: "2026-03-01",
      ref: "JE-0001",
      description: "Original",
      status: "draft",
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
      ],
    } as any);
    vi.mocked(repo.findEntryByRef!).mockResolvedValue({ id: "je_2", ref: "JE-0002" } as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.updateJournalEntryById("je_1", {
          id: "je_1",
          date: "2026-03-01",
          ref: "JE-0002",
          description: "Updated with conflicting ref",
          status: "draft",
          created_by: "admin",
          fiscal_year: "FY 2026",
          fiscal_year_id: "fy-open",
          simple_mode: false,
          tags: [],
          attachments: [],
          lines: [
            { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
            { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
          ],
        }),
      ),
    ).rejects.toThrow(/already exists/);
  });

  it("upsertEntries rejects intra-batch duplicate references", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    const useCases = createAccountingUseCases(repo);

    const baseEntry = {
      date: "2026-03-01",
      ref: "JE-DUP",
      description: "Batch entry",
      status: "draft" as const,
      created_by: "admin",
      fiscal_year: "FY 2026",
      fiscal_year_id: "fy-open",
      simple_mode: false,
      tags: [],
      attachments: [],
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 10, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 10, description: "" },
      ],
    };

    await expect(
      runWithTenant("demo", () =>
        useCases.upsertEntries([
          { ...baseEntry, id: "je_batch_1" } as any,
          { ...baseEntry, id: "je_batch_2" } as any,
        ]),
      ),
    ).rejects.toThrow(/Duplicate reference "JE-DUP" within the same batch/);
  });

  it("restoreJournalEntryById blocks restoration when an active entry holds the same reference", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findEntryById).mockResolvedValue({
      id: "je_trashed",
      ref: "JE-0042",
      deletedAt: "2026-03-01T00:00:00.000Z",
    } as any);
    vi.mocked(repo.findEntryByRef!).mockResolvedValue({
      id: "je_active",
      ref: "JE-0042",
    } as any);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () => useCases.restoreJournalEntryById("je_trashed")),
    ).rejects.toThrow(/already used by an active entry/);
  });

  it("upsertEntries allocates sequential non-colliding references when multiple entries in a batch omit references", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    const useCases = createAccountingUseCases(repo);

    const baseEntry = {
      date: "2026-03-01",
      ref: "",
      description: "Batch entry",
      status: "draft" as const,
      created_by: "admin",
      fiscal_year: "FY 2026",
      fiscal_year_id: "fy-open",
      simple_mode: false,
      tags: [],
      attachments: [],
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 10, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 10, description: "" },
      ],
    };

    const saved = await runWithTenant("demo", () =>
      useCases.upsertEntries([
        { ...baseEntry, id: "je_batch_1" } as any,
        { ...baseEntry, id: "je_batch_2" } as any,
        { ...baseEntry, id: "je_batch_3" } as any,
      ]),
    );

    expect(saved[0].ref).toBe("JE-0001");
    expect(saved[1].ref).toBe("JE-0002");
    expect(saved[2].ref).toBe("JE-0003");
    expect(repo.allocateVoucherNumbers).toHaveBeenCalledTimes(1);
  });

  it("upsertEntries keeps the stored ref when an existing entry is resent without one", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.findEntriesByIds).mockResolvedValue([
      { id: "je_kept", ref: "JE-0042", status: "draft", date: "2026-03-01", lines: [] },
    ] as any);
    const useCases = createAccountingUseCases(repo);

    const saved = await runWithTenant("demo", () =>
      useCases.upsertEntries([
        {
          id: "je_kept",
          date: "2026-03-01",
          ref: "",
          description: "Draft edit",
          status: "draft",
          created_by: "admin",
          fiscal_year: "FY 2026",
          fiscal_year_id: "fy-open",
          simple_mode: false,
          tags: [],
          attachments: [],
          lines: [
            { id: "l1", account_id: "acc_ar", debit: 10, credit: 0, description: "" },
            { id: "l2", account_id: "acc_income", debit: 0, credit: 10, description: "" },
          ],
        } as any,
      ]),
    );

    expect(saved[0].ref).toBe("JE-0042");
    expect(repo.allocateVoucherNumbers).not.toHaveBeenCalled();
  });

  it("createJournalEntry maps unique reference constraint 23505 to ConflictError", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    const uniqueErr = new Error("duplicate key value violates unique constraint") as any;
    uniqueErr.code = "23505";
    uniqueErr.constraint = "accounting_entries_workspace_ref_active_uidx";
    vi.mocked(repo.saveEntry).mockRejectedValue(uniqueErr);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.createJournalEntry({
          id: "je_new",
          date: "2026-03-01",
          ref: "JE-RACE",
          description: "Payment",
          status: "draft",
          created_by: "admin",
          fiscal_year: "FY 2026",
          fiscal_year_id: "fy-open",
          simple_mode: false,
          tags: [],
          attachments: [],
          lines: [
            { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
            { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
          ],
        }),
      ),
    ).rejects.toThrow(/already exists/);
  });

  it("updateJournalEntryById preserves existing reference when updated ref is blank or omitted", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.findEntryById).mockResolvedValue({
      id: "je_1",
      date: "2026-03-01",
      ref: "JE-KEEP-ME",
      description: "Original",
      status: "draft",
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
      ],
    } as any);
    const useCases = createAccountingUseCases(repo);

    const updated = await runWithTenant("demo", () =>
      useCases.updateJournalEntryById("je_1", {
        id: "je_1",
        date: "2026-03-01",
        ref: "   ",
        description: "Updated without changing ref",
        status: "draft",
        created_by: "admin",
        fiscal_year: "FY 2026",
        fiscal_year_id: "fy-open",
        simple_mode: false,
        tags: [],
        attachments: [],
        lines: [
          { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
          { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
        ],
      }),
    );

    expect(updated?.ref).toBe("JE-KEEP-ME");
  });

  it("updateJournalEntryById maps unique reference constraint 23505 to ConflictError", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.listFiscalYearsByWorkspace).mockResolvedValue([openYear] as any);
    vi.mocked(repo.findAccountsByIds).mockResolvedValue([
      { id: "acc_ar" },
      { id: "acc_income" },
    ] as any);
    vi.mocked(repo.findEntryById).mockResolvedValue({
      id: "je_1",
      date: "2026-03-01",
      ref: "JE-0001",
      description: "Original",
      status: "draft",
      lines: [
        { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
        { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
      ],
    } as any);
    const uniqueErr = new Error("duplicate key value violates unique constraint") as any;
    uniqueErr.code = "23505";
    uniqueErr.constraint = "accounting_entries_workspace_ref_active_uidx";
    vi.mocked(repo.saveEntry).mockRejectedValue(uniqueErr);
    const useCases = createAccountingUseCases(repo);

    await expect(
      runWithTenant("demo", () =>
        useCases.updateJournalEntryById("je_1", {
          id: "je_1",
          date: "2026-03-01",
          ref: "JE-RACE",
          description: "Updated with conflicting ref",
          status: "draft",
          created_by: "admin",
          fiscal_year: "FY 2026",
          fiscal_year_id: "fy-open",
          simple_mode: false,
          tags: [],
          attachments: [],
          lines: [
            { id: "l1", account_id: "acc_ar", debit: 50, credit: 0, description: "" },
            { id: "l2", account_id: "acc_income", debit: 0, credit: 50, description: "" },
          ],
        }),
      ),
    ).rejects.toThrow(/already exists/);
  });
});
