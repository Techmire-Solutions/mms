import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusToggle } from "./StatusToggle";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useAttendanceConfig: () => ({
    statuses: [
      { id: "present", label: "Present", short: "P", bg: "bg-success", text: "text-success" },
      { id: "absent", label: "Absent", short: "A", bg: "bg-destructive", text: "text-destructive" },
    ],
  }),
}));

describe("StatusToggle Component", () => {
  it("renders status buttons and toggles", () => {
    const html = renderToStaticMarkup(<StatusToggle value="present" onChange={vi.fn()} />);

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("P");
    expect(html).toContain("A");
  });
});
