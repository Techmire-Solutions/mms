import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceClassBar } from "./MarkAttendanceClassBar";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./MarkAttendanceGeoTag", () => ({
  MarkAttendanceGeoTag: () => <div data-testid="geotag">GeoTag</div>,
}));

describe("MarkAttendanceClassBar Component", () => {
  it("renders class name, bulk action buttons and Face AI toggle", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceClassBar
        classInfo={{ name: "Class 1A", facultyName: "Ustadh Ali" }}
        sessionInfo={{ name: "2024-2025" }}
        date="2025-01-01"
        submitted={false}
        isOffline={false}
        isDraft={false}
        geo={null}
        onRequestGeo={vi.fn()}
        onToggleFaceAI={vi.fn()}
        onMarkAll={vi.fn()}
      />,
    );

    expect(html).toContain("Class 1A");
    expect(html).toContain("Ustadh Ali");
    expect(html).toContain("attendance.mark.faceAi");
    expect(html).toContain("attendance.mark.allPresent");
    expect(html).toContain("attendance.mark.allAbsent");
  });
});
