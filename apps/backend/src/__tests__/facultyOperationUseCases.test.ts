/**
 * Faculty employee-ID backfill.
 *
 * The backfill is a Setup-write operation over many records: it must run inside
 * one tenant transaction (all-or-nothing), serialized by the faculty advisory
 * lock, and leave one authoritative audit row for the batch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  recordModernAuditEvent: vi.fn(),
  broadcastCollection: vi.fn(),
  reconcile: vi.fn(),
  loadPreferences: vi.fn(),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
  getRequestUserId: () => "admin-1",
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mocks.withTenant(...args),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mocks.broadcastCollection(...args),
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileFacultyContactsByFacultyIds: (...args: unknown[]) => mocks.reconcile(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => mocks.recordModernAuditEvent(...args),
  mapActionStringToAuditType: () => "UPDATE",
}));

vi.mock("../faculty/use-cases/facultyPreferencesService.js", () => ({
  loadFacultyModulePreferences: () => mocks.loadPreferences(),
}));

import { migrateFacultyMissingEmployeeIds } from "../faculty/use-cases/facultyOperationUseCases.js";

function makeRepo(saves: string[]) {
  return {
    lockHierarchy: vi.fn(async () => undefined),
    listActiveMissingEmployeeId: vi.fn(async () => [
      { id: "f1", contactId: "c1" },
      { id: "f2", contactId: "c2" },
    ]),
    countNextEmployeeId: vi.fn(async () => 0),
    findRegistrationConflict: vi.fn(async () => null),
    save: vi.fn(async (_t: string, row: { id: string }) => {
      saves.push(row.id);
    }),
  };
}

describe("migrateFacultyMissingEmployeeIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPreferences.mockResolvedValue({
      idPrefix: "FAC",
      idTemplate: "PREFIX",
      idDigits: 4,
      idStartSeq: 1,
      idRestartAnnually: false,
    });
    mocks.recordModernAuditEvent.mockResolvedValue(undefined);
    mocks.broadcastCollection.mockResolvedValue(undefined);
    mocks.reconcile.mockResolvedValue(undefined);
    // Stand-in tenant transaction: `execute` is the advisory-lock statement.
    mocks.withTenant.mockImplementation((_tenant: string, cb: (tx: unknown) => Promise<unknown>) =>
      cb({ execute: vi.fn().mockResolvedValue({ rows: [] }) }),
    );
  });

  it("runs the whole backfill inside one tenant transaction", async () => {
    const saves: string[] = [];
    const repo = makeRepo(saves);

    await migrateFacultyMissingEmployeeIds(repo as never, "admin-1");

    expect(mocks.withTenant).toHaveBeenCalledTimes(1);
    expect(repo.lockHierarchy).toHaveBeenCalledWith(expect.anything(), "demo");
    expect(saves).toEqual(["f1", "f2"]);
  });

  it("counts the sequence once and advances it locally instead of per row", async () => {
    // Per-row `computeNextFacultyEmployeeIdForSettings` re-read preferences, re-ran the
    // COUNT and probed collisions for every record (~3-4 queries/row).
    const saves: string[] = [];
    const repo = makeRepo(saves);

    await migrateFacultyMissingEmployeeIds(repo as never, "admin-1");

    expect(repo.countNextEmployeeId).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls.map(
      ([, row]) => (row as unknown as { employeeId: string }).employeeId,
    );
    expect(saved[0]).toMatch(/^FAC\d{4}0001$/);
    expect(saved[1]).toMatch(/^FAC\d{4}0002$/);
    expect(saved[0]).not.toBe(saved[1]);
  });

  it("appends one authoritative backfill audit row inside the transaction", async () => {
    const repo = makeRepo([]);

    await migrateFacultyMissingEmployeeIds(repo as never, "admin-1");

    expect(mocks.recordModernAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "faculty",
        actionType: "UPDATE",
        realUserId: "admin-1",
        newState: expect.objectContaining({ action: "faculty.employee_id_backfill" }),
      }),
    );
  });

  it("rolls the batch back and writes no audit row when a record fails", async () => {
    const repo = makeRepo([]);
    repo.save.mockImplementation(async (_t: string, row: { id: string }) => {
      if (row.id === "f2") throw new Error("boom");
    });

    await expect(migrateFacultyMissingEmployeeIds(repo as never, "admin-1")).rejects.toThrow(
      "boom",
    );

    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
    expect(mocks.broadcastCollection).not.toHaveBeenCalled();
  });

  it("does nothing (and audits nothing) when every faculty member already has an ID", async () => {
    const repo = makeRepo([]);
    repo.listActiveMissingEmployeeId.mockResolvedValue([]);

    await expect(migrateFacultyMissingEmployeeIds(repo as never, "admin-1")).resolves.toEqual({
      updated: 0,
    });

    expect(repo.save).not.toHaveBeenCalled();
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
    expect(mocks.broadcastCollection).not.toHaveBeenCalled();
  });
});
