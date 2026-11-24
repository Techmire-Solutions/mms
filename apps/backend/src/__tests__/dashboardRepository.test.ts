import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DashboardWidgetDto } from "@mms/contracts";
import {
  listDashboardWidgetsByWorkspace,
  upsertDashboardWidgetsForWorkspace,
  deleteDashboardWidgetById,
  reorderDashboardWidgetsForWorkspace,
  listAllDashboardWidgetsByWorkspace,
  replaceDashboardWidgetsForWorkspace,
} from "../db/repositories/dashboardWidgetsRepository.js";
import {
  getDashboardPreferencesByWorkspace,
  upsertDashboardPreferences,
  listAllDashboardPreferencesByWorkspace,
  replaceDashboardPreferencesForWorkspace,
  getDashboardPreferencesWithUpdatedAt,
  saveDashboardPreferencesCas,
} from "../db/repositories/dashboardPreferencesRepository.js";

const mockTx = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: vi.fn((_subdomain: string, cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
  withTenantRead: vi.fn((_subdomain: string, cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
}));

describe("dashboard repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dashboardWidgetsRepository", () => {
    const sampleWidget: DashboardWidgetDto = {
      id: "custom-1",
      title: "Active Students",
      category: "students",
      collection: "students",
      operation: "count",
      color: "emerald",
      isPinnedToDashboard: true,
      widgetType: "card",
      role: "admin",
      sortOrder: 1,
      titleKey: "dashboard.students",
      fixedSubText: "Registered students",
    };

    it("listDashboardWidgetsByWorkspace executes tenant transaction query and orders by sortOrder", async () => {
      const dbRow = {
        id: "custom-1",
        workspaceSubdomain: "demo",
        widgetType: "card",
        category: "students",
        collection: "students",
        role: "admin",
        isPinnedToDashboard: true,
        title: "Active Students",
        icon: null,
        color: "emerald",
        operation: "count",
        sortOrder: 1,
        config: { titleKey: "dashboard.students", fixedSubText: "Registered students" },
        updatedAt: new Date(),
      };

      const mockOffset = vi.fn().mockResolvedValue([dbRow]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.select.mockReturnValue({ from: mockFrom });

      const widgets = await listDashboardWidgetsByWorkspace("demo");

      expect(widgets).toHaveLength(1);
      expect(widgets[0].id).toBe("custom-1");
      expect(widgets[0].titleKey).toBe("dashboard.students");
      expect(widgets[0].fixedSubText).toBe("Registered students");
    });

    it("listAllDashboardWidgetsByWorkspace snapshots canonical DTOs for backup", async () => {
      const dbRow = {
        id: "w1",
        workspaceSubdomain: "demo",
        widgetType: "chart",
        category: "students",
        collection: "students",
        role: null,
        isPinnedToDashboard: true,
        title: "Enrollment trend",
        icon: null,
        color: "emerald",
        operation: "count",
        sortOrder: 0,
        config: { chartType: "area", titleKey: "dashboard.enrollment" },
        updatedAt: new Date(),
      };
      const mockWhere = vi.fn().mockResolvedValue([dbRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.select.mockReturnValue({ from: mockFrom });

      const rows = await listAllDashboardWidgetsByWorkspace("demo");

      expect(mockTx.select).toHaveBeenCalled();
      // The snapshot must be the same shape the write DTO accepts, so a restore
      // round-trips instead of nesting `config` inside `config`.
      expect(rows).toEqual([
        {
          id: "w1",
          widgetType: "chart",
          category: "students",
          collection: "students",
          isPinnedToDashboard: true,
          title: "Enrollment trend",
          color: "emerald",
          operation: "count",
          sortOrder: 0,
          chartType: "area",
          titleKey: "dashboard.enrollment",
        },
      ]);
      expect(rows[0]).not.toHaveProperty("config");
      expect(rows[0]).not.toHaveProperty("workspaceSubdomain");
    });

    it("upsertDashboardWidgetsForWorkspace invokes insert with onConflictDoUpdate on (workspaceSubdomain, id)", async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockTx.insert.mockReturnValue({ values: mockValues });

      await upsertDashboardWidgetsForWorkspace("demo", [sampleWidget]);

      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it("deleteDashboardWidgetById executes transaction soft delete", async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.update.mockReturnValue({ set: mockSet });

      await deleteDashboardWidgetById("demo", "custom-1", "u-admin");

      expect(mockTx.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it("reorderDashboardWidgetsForWorkspace updates sortOrder per widget in a transaction", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.update.mockReturnValue({ set: mockSet });

      await reorderDashboardWidgetsForWorkspace("demo", [
        { id: "custom-1", sortOrder: 5 },
        { id: "custom-2", sortOrder: 6 },
      ]);

      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it("replaceDashboardWidgetsForWorkspace soft-deletes old rows and inserts new rows during restore", async () => {
      const mockUpdateWhere = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockTx.update.mockReturnValue({ set: mockSet });
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockTx.insert.mockReturnValue({ values: mockValues });

      await replaceDashboardWidgetsForWorkspace("demo", [
        sampleWidget as unknown as Record<string, unknown>,
      ]);

      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });
    it("upsertDashboardWidgetsForWorkspace deduplicates widgets with duplicate IDs (last wins)", async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockTx.insert.mockReturnValue({ values: mockValues });

      const dup1 = { ...sampleWidget, id: "w-dup", title: "First" };
      const dup2 = { ...sampleWidget, id: "w-dup", title: "Second" };
      await upsertDashboardWidgetsForWorkspace("demo", [dup1, dup2]);

      expect(mockValues).toHaveBeenCalledTimes(1);
      // Only one row should be inserted after dedup
      const valuesArg = mockValues.mock.calls[0][0] as Array<{ title: string }>;
      expect(valuesArg).toHaveLength(1);
      expect(valuesArg[0].title).toBe("Second");
    });

    it("reorderDashboardWidgetsForWorkspace deduplicates order entries with duplicate IDs", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.update.mockReturnValue({ set: mockSet });

      await reorderDashboardWidgetsForWorkspace("demo", [
        { id: "w-dup", sortOrder: 1 },
        { id: "w-dup", sortOrder: 99 },
        { id: "w-other", sortOrder: 2 },
      ]);

      // Should still call update once with deduped IDs
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("dashboardPreferencesRepository", () => {
    it("getDashboardPreferencesByWorkspace queries workspace singleton preferences", async () => {
      const dbRow = {
        workspaceSubdomain: "demo",
        preferences: { gridMode: "compact", disabledCardIds: ["card-1"] },
        updatedAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([dbRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.select.mockReturnValue({ from: mockFrom });

      const prefs = await getDashboardPreferencesByWorkspace("demo");

      expect(prefs).toEqual({ gridMode: "compact", disabledCardIds: ["card-1"] });
    });

    it("listAllDashboardPreferencesByWorkspace fetches all rows for backup snapshot", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ workspaceSubdomain: "demo" }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.select.mockReturnValue({ from: mockFrom });

      const rows = await listAllDashboardPreferencesByWorkspace("demo");

      expect(rows).toEqual([{ workspaceSubdomain: "demo" }]);
    });

    it("upsertDashboardPreferences inserts workspace singleton with conflict update", async () => {
      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockTx.insert.mockReturnValue({ values: mockValues });

      await upsertDashboardPreferences("demo", { gridMode: "comfortable" });

      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it("replaceDashboardPreferencesForWorkspace wipes old preferences and re-inserts during backup restore", async () => {
      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      mockTx.delete.mockReturnValue({ where: mockDeleteWhere });
      const mockValues = vi.fn().mockResolvedValue([]);
      mockTx.insert.mockReturnValue({ values: mockValues });

      await replaceDashboardPreferencesForWorkspace("demo", [
        { preferences: { gridMode: "compact" } },
      ]);

      expect(mockTx.delete).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it("getDashboardPreferencesWithUpdatedAt reads preferences plus the OCC token", async () => {
      const dbRow = {
        preferences: { gridMode: "compact" },
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      const mockLimit = vi.fn().mockResolvedValue([dbRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.select.mockReturnValue({ from: mockFrom });

      const row = await getDashboardPreferencesWithUpdatedAt("demo");

      expect(row.preferences).toEqual({ gridMode: "compact" });
      expect(row.updatedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    });

    it("saveDashboardPreferencesCas returns null on a stale updatedAt token", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockTx.update.mockReturnValue({ set: mockSet });

      const result = await saveDashboardPreferencesCas(
        "demo",
        { gridMode: "compact" },
        new Date("2026-01-01T00:00:00.000Z"),
      );

      expect(result).toBeNull();
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it("saveDashboardPreferencesCas inserts only when no row exists (null token)", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
      mockTx.insert.mockReturnValue({ values: mockValues });

      const result = await saveDashboardPreferencesCas("demo", { gridMode: "compact" }, null);

      expect(result).toBeNull();
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockOnConflictDoNothing).toHaveBeenCalled();
    });
  });
});
