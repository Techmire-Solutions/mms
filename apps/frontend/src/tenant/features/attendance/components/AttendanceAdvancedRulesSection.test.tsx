import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceAdvancedRulesSection } from "./AttendanceAdvancedRulesSection";
import type { AttendanceSettings } from "@mms/shared";

describe("AttendanceAdvancedRulesSection Component", () => {
  it("renders advanced settings section and its save button", () => {
    const html = renderToStaticMarkup(
      <AttendanceAdvancedRulesSection
        settingsDraft={
          {
            offlineEnabled: true,
            geoTagging: false,
            defaultViewLayout: "list",
          } as AttendanceSettings
        }
        upd={vi.fn()}
        isPrefsDirty={true}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.settings.advanced");
    expect(html).toContain("attendance.settings.offlineMode");
    // The page-level footer owns Save; a section must not render a second one.
    expect(html).not.toContain("common.save");
  });
});
