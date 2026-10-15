import { describe, expect, it, vi } from "vitest";
import {
  setAttendancePreferencesMemory,
  fetchAttendancePreferences,
  saveAttendancePreferencesAsync,
  getAttendanceSettingsMemoryFallback,
} from "./attendanceSetupConfigApi";

vi.mock("@/lib/api", () => ({
  apiContract: {
    attendance: {
      getPreferences: vi.fn().mockResolvedValue({
        body: {
          preferences: {
            lateThresholdMins: 15,
          },
        },
      }),
      updatePreferences: vi.fn().mockResolvedValue({
        body: {
          preferences: {
            lateThresholdMins: 20,
          },
        },
      }),
    },
  },
}));

describe("attendanceSetupConfigApi utilities", () => {
  it("fetches and saves attendance preferences", async () => {
    const fetched = await fetchAttendancePreferences();
    expect(fetched).toBeDefined();

    const saved = await saveAttendancePreferencesAsync({
      lateThresholdMins: 20,
    } as unknown as never);
    expect(saved).toBeDefined();
  });

  it("manages in-memory fallback", () => {
    setAttendancePreferencesMemory({ lateThresholdMins: 25 } as unknown as never);
    const memory = getAttendanceSettingsMemoryFallback();
    expect(memory).toBeDefined();
  });
});
