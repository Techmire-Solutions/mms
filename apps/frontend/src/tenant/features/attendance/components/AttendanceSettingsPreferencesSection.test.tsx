import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceSettingsPreferencesSection } from "./AttendanceSettingsPreferencesSection";
import type { AttendanceSettings } from "@mms/shared";

const mockSettings: AttendanceSettings = {
  workingDays: ["monday", "tuesday"],
  allowExtraClassOnHolidays: false,
  lateThresholdMins: 15,
  autoAbsentAfterMins: 30,
  lockAfterSubmit: true,
  qrEnabled: false,
  lowAttendanceThreshold: 75,
  notifyParents: true,
  requireNoteForAbsent: false,
  offlineEnabled: true,
  geoTagging: false,
  defaultViewLayout: "list",
} as AttendanceSettings;

describe("AttendanceSettingsPreferencesSection Component", () => {
  it("renders timing rules, qr, alerts, and advanced settings cards", () => {
    const html = renderToStaticMarkup(
      <AttendanceSettingsPreferencesSection settingsDraft={mockSettings} upd={vi.fn()} />,
    );

    expect(html).toContain("attendance.settings.teachingDays");
    expect(html).toContain("attendance.settings.timingRules");
    expect(html).toContain("attendance.settings.qrAttendance");
    expect(html).toContain("attendance.settings.alerts");
    expect(html).toContain("attendance.settings.advanced");
  });
});
