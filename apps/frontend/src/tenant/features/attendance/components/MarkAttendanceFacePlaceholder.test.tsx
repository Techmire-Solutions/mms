import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceFacePlaceholder } from "./MarkAttendanceFacePlaceholder";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MarkAttendanceFacePlaceholder Component", () => {
  it("renders facial recognition placeholder with dismiss button", () => {
    const html = renderToStaticMarkup(<MarkAttendanceFacePlaceholder onClose={vi.fn()} />);

    expect(html).toContain("attendance.mark.facialRecognition");
    expect(html).toContain("attendance.mark.comingSoon");
    expect(html).toContain("attendance.mark.dismiss");
  });
});
