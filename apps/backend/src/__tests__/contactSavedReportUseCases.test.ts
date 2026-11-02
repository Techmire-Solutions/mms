import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenericSavedReport } from "@mms/shared";

const mockListByCategory = vi.fn();
const mockFindById = vi.fn();
const mockDeleteById = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  requireTenant: () => "demo",
}));

vi.mock("../db/repositories/savedReportsRepository.js", () => ({
  listSavedReportsByCategory: (...args: unknown[]) => mockListByCategory(...args),
  findSavedReportById: (...args: unknown[]) => mockFindById(...args),
  deleteSavedReportById: (...args: unknown[]) => mockDeleteById(...args),
  createPersistedSavedReport: vi.fn(),
  touchSavedReportRunById: vi.fn(),
}));

import {
  deleteContactsSavedReport,
  listContactsSavedReports,
} from "../contacts/use-cases/contactSavedReportUseCases.js";

function report(overrides: Partial<GenericSavedReport> = {}): GenericSavedReport {
  return {
    id: "r1",
    name: "My report",
    category: "contacts",
    filters: { shareScope: "private", drillDown: {} },
    createdBy: "u-owner",
    createdByName: "Owner",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastRun: null,
    ...overrides,
  } as GenericSavedReport;
}

describe("contacts saved-report authorization", () => {
  beforeEach(() => {
    mockListByCategory.mockReset();
    mockFindById.mockReset();
    mockDeleteById.mockReset().mockResolvedValue(true);
  });

  it("hides another user's private report from a non-admin viewer", async () => {
    mockListByCategory.mockResolvedValue([
      report({ id: "r1", createdBy: "u-owner" }),
      report({ id: "r2", createdBy: "u-me" }),
      report({
        id: "r3",
        createdBy: "u-owner",
        filters: { shareScope: "global", drillDown: {} },
      }),
      report({
        id: "r4",
        createdBy: "u-owner",
        filters: { shareScope: "users", sharedWithUserIds: ["u-me"], drillDown: {} },
      }),
    ]);

    const visible = await listContactsSavedReports({
      id: "u-me",
      role: "accountant",
      isAdmin: false,
    });

    expect(visible.map((entry) => entry.id)).toEqual(["r2", "r3", "r4"]);
  });

  it("shows every report to an admin", async () => {
    mockListByCategory.mockResolvedValue([report({ id: "r1", createdBy: "u-owner" })]);

    const visible = await listContactsSavedReports({ id: "u-admin", role: "admin", isAdmin: true });

    expect(visible.map((entry) => entry.id)).toEqual(["r1"]);
  });

  it("refuses to delete another user's report and does not touch the repository", async () => {
    mockFindById.mockResolvedValue(report({ id: "r1", createdBy: "u-owner" }));

    const deleted = await deleteContactsSavedReport("r1", {
      id: "u-me",
      role: "accountant",
      isAdmin: false,
    });

    expect(deleted).toBe(false);
    expect(mockDeleteById).not.toHaveBeenCalled();
  });

  it("deletes the owner's own report", async () => {
    mockFindById.mockResolvedValue(report({ id: "r1", createdBy: "u-me" }));

    const deleted = await deleteContactsSavedReport("r1", {
      id: "u-me",
      role: "accountant",
      isAdmin: false,
    });

    expect(deleted).toBe(true);
    expect(mockDeleteById).toHaveBeenCalledWith("demo", "r1", "contacts");
  });

  it("returns false for a missing report", async () => {
    mockFindById.mockResolvedValue(null);

    const deleted = await deleteContactsSavedReport("missing", {
      id: "u-me",
      role: "accountant",
      isAdmin: false,
    });

    expect(deleted).toBe(false);
    expect(mockDeleteById).not.toHaveBeenCalled();
  });
});
