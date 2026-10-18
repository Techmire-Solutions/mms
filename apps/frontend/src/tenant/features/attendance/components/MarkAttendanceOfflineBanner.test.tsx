import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceOfflineBanner } from "./MarkAttendanceOfflineBanner";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${params.count} offline records`;
      return key;
    },
  }),
}));

describe("MarkAttendanceOfflineBanner Component", () => {
  it("renders offline banner when offline is true", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceOfflineBanner
        offline={true}
        queue={[{ classId: "cls-1" } as unknown as never]}
        onSync={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.mark.offlineBannerOffline");
    expect(html).toContain("attendance.mark.syncNow");
  });

  it("renders sync notification when online with queued records", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceOfflineBanner
        offline={false}
        queue={[{ classId: "cls-1" } as unknown as never]}
        onSync={vi.fn()}
      />,
    );

    expect(html).toContain("1 offline records");
    expect(html).toContain("attendance.mark.syncNow");
  });
});
