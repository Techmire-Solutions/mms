import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceGeoTag } from "./MarkAttendanceGeoTag";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MarkAttendanceGeoTag Component", () => {
  it("renders tag button when geo is null", () => {
    const html = renderToStaticMarkup(<MarkAttendanceGeoTag geo={null} onRequest={vi.fn()} />);

    expect(html).toContain("attendance.mark.tagLocation");
  });

  it("renders coordinates when geo is provided", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceGeoTag geo={{ lat: 31.5204, lng: 74.3587 }} onRequest={vi.fn()} />,
    );

    expect(html).toContain("31.5204");
    expect(html).toContain("74.3587");
  });
});
