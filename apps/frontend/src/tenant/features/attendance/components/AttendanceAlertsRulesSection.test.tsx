import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceAlertsRulesSection } from "./AttendanceAlertsRulesSection";
import type { AttendanceSettings } from "@mms/shared";

describe("AttendanceAlertsRulesSection Component", () => {
  it("renders alerts section and its save button", () => {
    const html = renderToStaticMarkup(
      <AttendanceAlertsRulesSection
        settingsDraft={
          {
            lowAttendanceThreshold: 75,
            notifyParents: true,
            requireNoteForAbsent: false,
          } as AttendanceSettings
        }
        upd={vi.fn()}
        isPrefsDirty={true}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.settings.alerts");
    expect(html).toContain("attendance.settings.lowThreshold");
    expect(html).toContain("attendance.settings.notifyParents");
    // The page-level footer owns Save; a section must not render a second one.
    expect(html).not.toContain("common.save");
  });
});
