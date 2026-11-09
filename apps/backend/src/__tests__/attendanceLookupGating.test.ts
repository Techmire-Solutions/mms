import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Status lookup gating.
 *
 * `half_day` is only offered when the school enables half-day tracking, and a lookup row may only
 * carry a canonical status id — a custom id would be rejected by the DB CHECK the first time a mark
 * used it.
 */

const mocks = vi.hoisted(() => ({
  listByWorkspace: vi.fn(),
  replaceKind: vi.fn(),
  preferences: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../db/repositories/attendanceLookupsRepository.js", () => ({
  listAttendanceLookupsByWorkspace: mocks.listByWorkspace,
  replaceAttendanceLookupsForKind: mocks.replaceKind,
}));
vi.mock("../db/repositories/attendanceModulePreferencesRepository.js", () => ({
  getAttendanceModulePreferences: mocks.preferences,
}));
vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: mocks.broadcast }));

const { loadAttendanceLookupsMap, replaceAttendanceLookupKind } =
  await import("../services/attendanceLookupsService.js");

function lookupRow(id: string, label: string) {
  return { id: `demo:statuses:${id}`, kind: "statuses", label, meta: {}, sortOrder: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preferences.mockResolvedValue({ trackHalfDay: true });
  mocks.listByWorkspace.mockResolvedValue([]);
});

describe("loadAttendanceLookupsMap", () => {
  it("offers half_day when half-day tracking is on", async () => {
    const map = await loadAttendanceLookupsMap("demo");
    expect(map.statuses.map((status) => status.id)).toContain("half_day");
  });

  it("strips half_day when tracking is off", async () => {
    mocks.preferences.mockResolvedValue({ trackHalfDay: false });
    const map = await loadAttendanceLookupsMap("demo");
    expect(map.statuses.map((status) => status.id)).not.toContain("half_day");
    expect(map.statuses.map((status) => status.id)).toContain("present");
  });

  it("drops a stored lookup whose id is outside the status domain", async () => {
    mocks.listByWorkspace.mockResolvedValue([
      lookupRow("present", "Here"),
      lookupRow("holiday", "Holiday"),
    ]);
    const map = await loadAttendanceLookupsMap("demo");
    expect(map.statuses.map((status) => status.id)).toEqual(["present"]);
  });
});

describe("replaceAttendanceLookupKind", () => {
  it("rejects a half_day lookup while tracking is off", async () => {
    mocks.preferences.mockResolvedValue({ trackHalfDay: false });
    await expect(
      replaceAttendanceLookupKind(
        "statuses",
        [
          {
            id: "present",
            label: "Present",
            short: "P",
            color: "",
            bg: "",
            text: "",
            border: "",
            dot: "",
          },
          {
            id: "half_day",
            label: "Half",
            short: "H",
            color: "",
            bg: "",
            text: "",
            border: "",
            dot: "",
          },
        ],
        "demo",
      ),
    ).rejects.toMatchObject({ statusCode: 422, type: "attendance_half_day_disabled" });
    expect(mocks.replaceKind).not.toHaveBeenCalled();
  });

  it("saves when half-day tracking is on", async () => {
    await replaceAttendanceLookupKind(
      "statuses",
      [
        {
          id: "half_day",
          label: "Half",
          short: "H",
          color: "",
          bg: "",
          text: "",
          border: "",
          dot: "",
        },
      ],
      "demo",
    );
    expect(mocks.replaceKind).toHaveBeenCalled();
  });
});
