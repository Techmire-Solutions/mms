import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, teacherToken, viewerToken } from "./helpers/tokens.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockLoadDashboardPreferences = vi.fn();
const mockSaveDashboardPreferences = vi.fn();
const mockLoadDashboardWidgets = vi.fn();
const mockUpsertDashboardWidgets = vi.fn();
const mockDeleteDashboardWidget = vi.fn();
const mockReorderDashboardWidgets = vi.fn();
const mockLoadDashboardSummary = vi.fn();
const mockBroadcastDashboardWidgetsChanged = vi.fn();
const mockEvictDashboardPreferencesCache = vi.fn();

vi.mock("../services/dashboardPreferencesService.js", () => ({
  loadDashboardPreferences: (...args: unknown[]) => mockLoadDashboardPreferences(...args),
  saveDashboardPreferences: (...args: unknown[]) => mockSaveDashboardPreferences(...args),
  evictDashboardPreferencesCache: (...args: unknown[]) =>
    mockEvictDashboardPreferencesCache(...args),
}));

vi.mock("../lib/dashboardWidgetsService.js", () => ({
  loadDashboardWidgets: (...args: unknown[]) => mockLoadDashboardWidgets(...args),
  upsertDashboardWidgets: (...args: unknown[]) => mockUpsertDashboardWidgets(...args),
  deleteDashboardWidget: (...args: unknown[]) => mockDeleteDashboardWidget(...args),
  reorderDashboardWidgets: (...args: unknown[]) => mockReorderDashboardWidgets(...args),
  broadcastDashboardWidgetsChanged: (...args: unknown[]) =>
    mockBroadcastDashboardWidgetsChanged(...args),
}));

vi.mock("../services/dashboardSummaryService.js", () => ({
  loadDashboardSummary: (...args: unknown[]) => mockLoadDashboardSummary(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

const sampleWidget = {
  id: "custom-1",
  title: "My KPI",
  category: "students",
  collection: "students",
  operation: "count",
  color: "emerald",
  isPinnedToDashboard: true,
};

describe("dashboard config routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
    mockLoadDashboardPreferences.mockResolvedValue(null);
    mockSaveDashboardPreferences.mockResolvedValue({
      disabledCardIds: [],
      gridMode: "compact",
      enrollmentChartType: "area",
      enrollmentChartColor: "emerald",
      enrollmentChartPeriod: 10,
      revenueChartType: "bar",
      revenueChartColor: "mixed",
      attendanceChartType: "bar",
      attendanceChartColor: "semantic",
      hasanatChartType: "pie",
      hasanatChartColor: "mixed",
    });
    mockLoadDashboardWidgets.mockResolvedValue([sampleWidget]);
    mockUpsertDashboardWidgets.mockResolvedValue([sampleWidget]);
    mockDeleteDashboardWidget.mockResolvedValue(true);
  });

  it("GET preferences/widgets allowed for any authenticated tenant; PUT/DELETE gated on setupWrite", async () => {
    const app = await buildApp();

    // GET preferences — teacher (authenticated) allowed (dashboard is home).
    const prefsReadTeacher = await app.inject({
      method: "GET",
      url: "/api/dashboard/preferences",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(prefsReadTeacher.statusCode).toBe(200);

    // GET widgets — viewer allowed.
    const widgetsReadViewer = await app.inject({
      method: "GET",
      url: "/api/dashboard/widgets",
      headers: { host: "demo.localhost", authorization: `Bearer ${viewerToken(app)}` },
    });
    expect(widgetsReadViewer.statusCode).toBe(200);

    // PUT preferences — teacher denied (no settings.global.write).
    const prefsWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/dashboard/preferences",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: { gridMode: "compact" },
    });
    expect(prefsWriteDenied.statusCode).toBe(403);

    // PUT widgets — admin allowed.
    const widgetsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/dashboard/widgets",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: [sampleWidget],
    });
    expect(widgetsWriteOk.statusCode).toBe(200);
    expect(mockUpsertDashboardWidgets).toHaveBeenCalled();

    // Partial PUT must merge over the stored document, not reset omitted keys.
    mockLoadDashboardPreferences.mockResolvedValue({
      disabledCardIds: ["keep-me"],
      gridMode: "comfortable",
      lowAttendanceThreshold: 80,
      urgentAttendanceThreshold: 55,
      enrollmentChartType: "area",
      enrollmentChartColor: "#000000",
      enrollmentChartPeriod: 6,
      revenueChartType: "bar",
      revenueChartColor: "#000000",
      attendanceChartType: "line",
      attendanceChartColor: "#000000",
      hasanatChartType: "bar",
      hasanatChartColor: "#000000",
    });

    // PUT preferences — admin allowed.
    const prefsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/dashboard/preferences",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { gridMode: "compact" },
    });
    expect(prefsWriteOk.statusCode).toBe(200);
    expect(mockSaveDashboardPreferences).toHaveBeenCalled();
    expect(mockSaveDashboardPreferences.mock.calls.at(-1)?.[0]).toMatchObject({
      gridMode: "compact",
      disabledCardIds: ["keep-me"],
      lowAttendanceThreshold: 80,
      urgentAttendanceThreshold: 55,
    });

    // DELETE widget — teacher denied.
    const deleteDenied = await app.inject({
      method: "DELETE",
      url: "/api/dashboard/widgets/custom-1",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(deleteDenied.statusCode).toBe(403);

    // DELETE widget — admin allowed.
    const deleteOk = await app.inject({
      method: "DELETE",
      url: "/api/dashboard/widgets/custom-1",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
    });
    expect(deleteOk.statusCode).toBe(200);
    expect(mockDeleteDashboardWidget).toHaveBeenCalledWith("custom-1");

    await app.close();
  });

  it("rejects an invalid widget payload with 422", async () => {
    const app = await buildApp();
    const invalid = await app.inject({
      method: "PUT",
      url: "/api/dashboard/widgets",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: [
        {
          id: "x",
          operation: "median",
          color: "emerald",
          isPinnedToDashboard: true,
          title: "t",
          category: "c",
          collection: "c",
        },
      ],
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it("PUT /api/dashboard/widgets/reorder is gated on write permissions and updates order", async () => {
    const app = await buildApp();
    mockReorderDashboardWidgets.mockResolvedValue([sampleWidget]);

    const denied = await app.inject({
      method: "PUT",
      url: "/api/dashboard/widgets/reorder",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: { order: [{ id: "custom-1", sortOrder: 0 }] },
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "PUT",
      url: "/api/dashboard/widgets/reorder",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { order: [{ id: "custom-1", sortOrder: 0 }] },
    });
    expect(allowed.statusCode).toBe(200);
    expect(mockReorderDashboardWidgets).toHaveBeenCalledWith([{ id: "custom-1", sortOrder: 0 }]);
    // The live update is broadcast after the write transaction commits.
    expect(mockBroadcastDashboardWidgetsChanged).toHaveBeenCalled();

    await app.close();
  });

  it("rejects an oversized or non-integer reorder body with 400 instead of 500", async () => {
    const app = await buildApp();
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ id: `w-${i}`, sortOrder: i }));

    const oversized = await app.inject({
      method: "PUT",
      url: "/api/dashboard/widgets/reorder",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { order: tooMany },
    });
    expect(oversized.statusCode).toBe(400);
    expect(mockReorderDashboardWidgets).not.toHaveBeenCalled();

    for (const sortOrder of [1.5, -1]) {
      const invalid = await app.inject({
        method: "PUT",
        url: "/api/dashboard/widgets/reorder",
        headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
        payload: { order: [{ id: "custom-1", sortOrder }] },
      });
      expect(invalid.statusCode, `sortOrder=${sortOrder}`).toBe(400);
    }
    expect(mockReorderDashboardWidgets).not.toHaveBeenCalled();

    await app.close();
  });

  it("evicts the preferences cache only after the write commits", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "PUT",
      url: "/api/dashboard/preferences",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { gridMode: "compact" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockEvictDashboardPreferencesCache).toHaveBeenCalledTimes(1);
    // Denied writes must not touch the cache.
    mockEvictDashboardPreferencesCache.mockClear();
    const denied = await app.inject({
      method: "PUT",
      url: "/api/dashboard/preferences",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: { gridMode: "compact" },
    });
    expect(denied.statusCode).toBe(403);
    expect(mockEvictDashboardPreferencesCache).not.toHaveBeenCalled();

    await app.close();
  });

  it("GET /api/dashboard/summary returns composite summary for authenticated tenant", async () => {
    const app = await buildApp();
    mockLoadDashboardSummary.mockResolvedValue({
      students: { total: 10, active: 8, inactive: 2, suspended: 0, newThisPeriod: 1 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      summary: {
        students: { total: 10, active: 8, inactive: 2, suspended: 0, newThisPeriod: 1 },
      },
    });

    await app.close();
  });

  it("GET /api/dashboard/summary reports an atomic snapshot failure", async () => {
    const app = await buildApp();
    mockLoadDashboardSummary.mockRejectedValueOnce(new Error("metric query failed"));

    const res = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      type: "database_error",
      message: "Failed to load dashboard summary",
    });

    await app.close();
  });

  it("returns 404 when the widget to delete no longer exists", async () => {
    const app = await buildApp();
    mockDeleteDashboardWidget.mockResolvedValueOnce(false);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/dashboard/widgets/already-gone",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "not_found" });
    await app.close();
  });

  it("audits a widget reorder", async () => {
    const app = await buildApp();
    mockReorderDashboardWidgets.mockResolvedValueOnce([sampleWidget]);

    const res = await app.inject({
      method: "PUT",
      url: "/api/dashboard/widgets/reorder",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { order: [{ id: "custom-1", sortOrder: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(recordModernAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "dashboard",
        recordId: "widgets",
        newState: expect.objectContaining({ action: "dashboard.widgets.reorder" }),
      }),
    );
    await app.close();
  });

  it("logs and answers 500 when a dashboard read fails", async () => {
    const app = await buildApp();
    mockLoadDashboardPreferences.mockRejectedValueOnce(new Error("db down"));

    const res = await app.inject({
      method: "GET",
      url: "/api/dashboard/preferences",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      type: "database_error",
      message: "Failed to load dashboard preferences",
    });
    await app.close();
  });
});
