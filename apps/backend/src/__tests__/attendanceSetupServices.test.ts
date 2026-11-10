import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Attendance setup services.
 *
 * These two adapters had no tests at all: they are the only place the attendance preferences and field
 * config are normalised and persisted, so a silent default (e.g. `trackHalfDay`) or a broadcast-key
 * typo would only show up in a browser.
 */

const mocks = vi.hoisted(() => ({
  tenant: "demo" as string | null,
  getPreferences: vi.fn(),
  setPreferences: vi.fn(),
  getFieldConfig: vi.fn(),
  setFieldConfig: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../lib/tenantContext.js", () => ({
  requireTenant: () => {
    if (!mocks.tenant) throw new Error("Tenant context required");
    return mocks.tenant;
  },
  getRequestTenant: () => mocks.tenant,
}));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: mocks.broadcast }));
vi.mock("../db/repositories/attendanceModulePreferencesRepository.js", () => ({
  getAttendanceModulePreferences: mocks.getPreferences,
  setAttendanceModulePreferences: mocks.setPreferences,
}));
vi.mock("../db/repositories/attendanceFieldConfigRepository.js", () => ({
  getAttendanceFieldConfig: mocks.getFieldConfig,
  setAttendanceFieldConfig: mocks.setFieldConfig,
}));

const { getAttendancePreferencesService, updateAttendancePreferencesService } =
  await import("../services/attendancePreferencesService.js");
const { getAttendanceFieldConfigService } = await import("../services/attendanceConfigService.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenant = "demo";
  mocks.getPreferences.mockResolvedValue(null);
  mocks.getFieldConfig.mockResolvedValue(null);
});

describe("attendance preferences service", () => {
  it("normalises a stored payload and keeps the half-day default", async () => {
    mocks.getPreferences.mockResolvedValue({ cutoffTime: "09:15" });
    const prefs = await getAttendancePreferencesService();

    expect(prefs).toMatchObject({ cutoffTime: "09:15" });
    expect(prefs?.trackHalfDay).toBe(true);
    expect(mocks.getPreferences).toHaveBeenCalledWith("demo");
  });

  it("returns null when the tenant has never saved preferences", async () => {
    expect(await getAttendancePreferencesService()).toBeNull();
  });

  it("persists normalised preferences (not the raw payload) and broadcasts", async () => {
    mocks.setPreferences.mockResolvedValue(undefined);
    const result = await updateAttendancePreferencesService({
      cutoffTime: "09:15",
      unknownFutureKey: "ignored",
    } as never);

    expect(result.cutoffTime).toBe("09:15");
    // Defaults are filled in, and unknown keys never reach the repository.
    expect(result.trackHalfDay).toBe(true);
    expect(result).not.toHaveProperty("unknownFutureKey");
    expect(mocks.setPreferences).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ cutoffTime: "09:15" }),
    );
    expect(mocks.setPreferences.mock.calls[0]?.[1]).not.toHaveProperty("unknownFutureKey");
    expect(mocks.broadcast).toHaveBeenCalledWith("attendance");
  });

  it("refuses to work without an ambient tenant", async () => {
    mocks.tenant = null;
    await expect(getAttendancePreferencesService()).rejects.toThrow(/tenant/i);
  });
});

describe("attendance field-config service", () => {
  it("composes stored config with preferences into settings", async () => {
    mocks.getFieldConfig.mockResolvedValue({ tabs: [], fields: {} });
    mocks.getPreferences.mockResolvedValue({ trackHalfDay: false });

    const settings = await getAttendanceFieldConfigService();
    expect(settings).toBeTruthy();
    expect(mocks.getFieldConfig).toHaveBeenCalledWith("demo");
  });

  it("returns null when no config has been saved", async () => {
    expect(await getAttendanceFieldConfigService()).toBeNull();
  });
});
