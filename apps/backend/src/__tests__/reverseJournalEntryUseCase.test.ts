import { AsyncLocalStorage } from "node:async_hooks";
import { describe, expect, it } from "vitest";
import type { Account, FiscalYear, JournalEntry } from "@mms/shared";
import type { RecordModernAuditInput } from "../services/auditTrailService.js";
import {
  reverseJournalEntry,
  type ReverseJournalEntryDeps,
} from "../accounting/use-cases/reverseJournalEntryUseCase.js";

const TENANT = "demo";
const ACTOR = { id: "user-1", name: "Amina Accountant" };
const NOW = new Date("2026-10-08T09:30:00.000Z");

const year = (
  id: string,
  startDate: string,
  endDate: string,
  status: FiscalYear["status"],
): FiscalYear => ({
  id,
  label: id,
  startDate,
  endDate,
  status,
});
const FY2025_CLOSED = year("FY2025", "2025-01-01", "2025-12-31", "closed");
const FY2026_OPEN = year("FY2026", "2026-01-01", "2026-12-31", "active");

const account = (id: string, isActive = true): Account =>
  ({
    id,
    code: id,
    name: id,
    type: "Asset",
    subtype: "",
    description: "",
    isActive,
  }) as Account;

function posted(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "je-orig",
    date: "2026-09-15",
    ref: "JV-2026-0001",
    description: "Office supplies",
    status: "posted",
    created_by: "Amina",
    tags: [],
    attachments: [],
    fiscal_year: "FY2026",
    fiscal_year_id: "FY2026",
    source_type: "manual",
    lines: [
      { id: "l1", account_id: "office", debit: 50000, credit: 0, description: "Supplies" },
      { id: "l2", account_id: "cash", debit: 0, credit: 50000, description: "" },
    ],
    ...overrides,
  };
}

interface Harness {
  deps: ReverseJournalEntryDeps;
  entries: JournalEntry[];
  audit: RecordModernAuditInput[];
  broadcasts: string[];
}

/**
 * In-memory ledger with transactional staging (writes commit only when the
 * work resolves) and a real per-id mutex, so rollback and concurrency are
 * observable without PostgreSQL.
 */
function createHarness(
  options: {
    entries?: JournalEntry[];
    years?: FiscalYear[];
    accounts?: Account[];
    failAudit?: boolean;
  } = {},
): Harness {
  const entries = [...(options.entries ?? [posted()])];
  const audit: RecordModernAuditInput[] = [];
  const broadcasts: string[] = [];
  const locks = new Map<string, Promise<void>>();
  const tx = new AsyncLocalStorage<{
    staged: JournalEntry[];
    stagedAudit: RecordModernAuditInput[];
    releases: (() => void)[];
  }>();
  const visible = () => [...entries, ...(tx.getStore()?.staged ?? [])];

  const deps: ReverseJournalEntryDeps = {
    transaction: async (_tenant, work) => {
      const state = {
        staged: [] as JournalEntry[],
        stagedAudit: [] as RecordModernAuditInput[],
        releases: [] as (() => void)[],
      };
      try {
        const result = await tx.run(state, work);
        entries.push(...state.staged);
        audit.push(...state.stagedAudit);
        return result;
      } finally {
        state.releases.forEach((release) => release());
      }
    },
    lockJournalEntries: async (_tenant, ids) => {
      for (const id of ids) {
        while (locks.has(id)) await locks.get(id);
        let release = () => {};
        locks.set(
          id,
          new Promise<void>((resolve) => {
            release = () => {
              locks.delete(id);
              resolve();
            };
          }),
        );
        tx.getStore()?.releases.push(release);
      }
    },
    findEntryById: async (_tenant, id) => visible().find((entry) => entry.id === id) ?? null,
    findActiveReversalOf: async (_tenant, original) => {
      const hit = visible().find(
        (entry) =>
          !entry.deletedAt &&
          ((entry.source_type === "reversal" && entry.source_id === original.id) ||
            (original.ref !== "" && entry.reversed_ref === original.ref)),
      );
      return hit ? { id: hit.id, ref: hit.ref } : null;
    },
    listFiscalYears: async () => options.years ?? [FY2026_OPEN],
    findAccountsByIds: async (_tenant, ids) =>
      (options.accounts ?? [account("office"), account("cash")]).filter((row) =>
        ids.includes(row.id),
      ),
    saveEntry: async (_tenant, entry) => {
      // Let a concurrent request interleave here, as a real DB round-trip would.
      await new Promise((resolve) => setImmediate(resolve));
      tx.getStore()?.staged.push(entry);
    },
    recordAudit: async (input) => {
      if (options.failAudit) throw new Error("audit append failed");
      tx.getStore()?.stagedAudit.push(input);
    },
    broadcast: (tenant) => {
      broadcasts.push(tenant);
    },
    now: () => NOW,
  };
  return { deps, entries, audit, broadcasts };
}

const request = (date: string, reason = "Posted to the wrong expense account") => ({
  date,
  reason,
});

describe("reverseJournalEntry", () => {
  it("given a posted multi-line entry, should post a balanced reversing journal with swapped lines and keep the original intact", async () => {
    // Arrange
    const original = posted({
      lines: [
        { id: "a", account_id: "office", debit: 30000, credit: 0, description: "Paper" },
        { id: "b", account_id: "office", debit: 20000, credit: 0, description: "Ink" },
        { id: "c", account_id: "cash", debit: 0, credit: 50000, description: "" },
      ],
    });
    const harness = createHarness({ entries: [original] });
    const snapshot = structuredClone(original);

    // Act
    const result = await reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-09-15"),
      ACTOR,
      harness.deps,
    );

    // Assert
    expect(result.entry.lines.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["office", 0, 30000],
      ["office", 0, 20000],
      ["cash", 50000, 0],
    ]);
    expect(result.entry).toMatchObject({
      date: "2026-09-15",
      status: "posted",
      source_type: "reversal",
      source_id: "je-orig",
      reversed_ref: "JV-2026-0001",
      ref: "REV-JV-2026-0001",
      created_by: "Amina Accountant",
      fiscal_year_id: "FY2026",
      tags: ["Reversal"],
      description: "Reversal of JV-2026-0001: Posted to the wrong expense account",
    });
    expect(harness.entries[0]).toEqual(snapshot);
    expect(harness.entries).toHaveLength(2);
    expect(harness.broadcasts).toEqual([TENANT]);
  });

  it("given an open original period, should accept the original posting date and a later open date (Rule A)", async () => {
    // Arrange
    const first = createHarness();
    const second = createHarness();

    // Act
    const sameDate = await reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-09-15"),
      ACTOR,
      first.deps,
    );
    const today = await reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-10-08"),
      ACTOR,
      second.deps,
    );

    // Assert
    expect(sameDate.entry.date).toBe("2026-09-15");
    expect(today.entry.date).toBe("2026-10-08");
    expect(today.priorPeriod).toBe(false);
  });

  it("given a closed original period, should reject the original date and accept the current open period (Rule B/C)", async () => {
    // Arrange
    const old = posted({ date: "2025-09-15", fiscal_year: "FY2025", fiscal_year_id: "FY2025" });
    const harness = createHarness({ entries: [old], years: [FY2025_CLOSED, FY2026_OPEN] });

    // Act
    const rejected = reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2025-09-15"),
      ACTOR,
      harness.deps,
    );

    // Assert
    await expect(rejected).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/closed accounting period/),
    });
    const accepted = await reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-10-08"),
      ACTOR,
      harness.deps,
    );
    expect(accepted.entry.fiscal_year_id).toBe("FY2026");
    expect(accepted.priorPeriod).toBe(true);
    expect(accepted.entry.tags).toEqual(["Reversal", "Prior Period"]);
  });

  it("given invalid dates, should reject before-original, malformed and unconfigured-period dates", async () => {
    // Arrange
    const harness = createHarness();

    // Act
    const attempts = ["2026-09-14", "2026-02-30", "2027-01-04"].map((date) =>
      reverseJournalEntry(TENANT, "je-orig", request(date), ACTOR, harness.deps),
    );

    // Assert
    await expect(attempts[0]).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/earlier than the original/),
    });
    await expect(attempts[1]).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/real calendar date/),
    });
    await expect(attempts[2]).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/outside every configured fiscal year/),
    });
    expect(harness.entries).toHaveLength(1);
  });

  it("given an already reversed journal, should refuse a second reversal with 409", async () => {
    // Arrange
    const harness = createHarness();
    await reverseJournalEntry(TENANT, "je-orig", request("2026-10-08"), ACTOR, harness.deps);

    // Act
    const again = reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-10-08"),
      ACTOR,
      harness.deps,
    );

    // Assert
    await expect(again).rejects.toMatchObject({ statusCode: 409 });
    expect(harness.entries).toHaveLength(2);
  });

  it("given a legacy client-created reversal linked only by reversed_ref, should treat the journal as already reversed", async () => {
    // Arrange
    const legacy = posted({
      id: "je-legacy",
      ref: "REV-JV-2026-0001-1",
      source_type: "manual",
      reversed_ref: "JV-2026-0001",
    });
    const harness = createHarness({ entries: [posted(), legacy] });

    // Act
    const attempt = reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-10-08"),
      ACTOR,
      harness.deps,
    );

    // Assert
    await expect(attempt).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/REV-JV-2026-0001-1/),
    });
  });

  it("given two concurrent reversal requests, should commit exactly one reversal", async () => {
    // Arrange
    const harness = createHarness();

    // Act
    const outcomes = await Promise.allSettled([
      reverseJournalEntry(TENANT, "je-orig", request("2026-10-08"), ACTOR, harness.deps),
      reverseJournalEntry(TENANT, "je-orig", request("2026-10-08"), ACTOR, harness.deps),
    ]);

    // Assert
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(harness.entries.filter((entry) => entry.source_type === "reversal")).toHaveLength(1);
    expect(harness.audit).toHaveLength(1);
  });

  it("given ineligible journals, should reject drafts, missing entries and Finance/closing postings", async () => {
    // Arrange
    const harness = createHarness({
      entries: [
        posted({ id: "je-draft", status: "draft" }),
        posted({ id: "je-inv", source_type: "invoice", source_id: "inv-1" }),
        posted({ id: "je-pay", source_type: "payment", source_id: "pay-1" }),
        posted({ id: "je-close", source_type: "closing", source_id: "FY2025" }),
        posted({ id: "je-trashed", deletedAt: "2026-10-01T00:00:00.000Z" }),
      ],
    });
    const attempt = (id: string) =>
      reverseJournalEntry(TENANT, id, request("2026-10-08"), ACTOR, harness.deps);

    // Act
    const results = await Promise.allSettled(
      ["je-draft", "je-inv", "je-pay", "je-close", "je-trashed", "je-none"].map(attempt),
    );

    // Assert
    expect(
      results.map((result) =>
        result.status === "rejected" ? (result.reason as { statusCode: number }).statusCode : 0,
      ),
    ).toEqual([422, 422, 422, 422, 404, 404]);
    expect(harness.entries).toHaveLength(5);
  });

  it("given a deactivated account on the original, should refuse the reversal", async () => {
    // Arrange
    const harness = createHarness({ accounts: [account("office", false), account("cash")] });

    // Act
    const attempt = reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-10-08"),
      ACTOR,
      harness.deps,
    );

    // Assert
    await expect(attempt).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/deactivated accounts: office/),
    });
  });

  it("given the audit append fails, should roll back the reversal so nothing is partially posted", async () => {
    // Arrange
    const harness = createHarness({ failAudit: true });

    // Act
    const attempt = reverseJournalEntry(
      TENANT,
      "je-orig",
      request("2026-10-08"),
      ACTOR,
      harness.deps,
    );

    // Assert
    await expect(attempt).rejects.toThrow("audit append failed");
    expect(harness.entries).toHaveLength(1);
    expect(harness.broadcasts).toEqual([]);
  });

  it("given a successful reversal, should write a server-timestamped audit event linking both journals", async () => {
    // Arrange
    const harness = createHarness();

    // Act
    const result = await reverseJournalEntry(
      TENANT,
      "je-orig",
      { ...request("2026-10-08"), remarks: "Per auditor note 14" },
      ACTOR,
      harness.deps,
    );

    // Assert
    expect(result.executedAt).toBe("2026-10-08T09:30:00.000Z");
    expect(harness.audit).toEqual([
      expect.objectContaining({
        workspaceSubdomain: TENANT,
        tableName: "accounting_entries",
        recordId: result.entry.id,
        actionType: "CREATE",
        realUserId: "user-1",
        transactionTimestamp: NOW,
        newState: {
          event: "journal_reversal",
          originalEntryId: "je-orig",
          originalRef: "JV-2026-0001",
          originalPostingDate: "2026-09-15",
          reversalEntryId: result.entry.id,
          reversalRef: "REV-JV-2026-0001",
          reversalPostingDate: "2026-10-08",
          executedAt: "2026-10-08T09:30:00.000Z",
          reversedBy: "user-1",
          reason: "Posted to the wrong expense account",
          remarks: "Per auditor note 14",
          priorPeriod: false,
        },
      }),
    ]);
  });
});
