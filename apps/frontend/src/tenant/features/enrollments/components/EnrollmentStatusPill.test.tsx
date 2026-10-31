import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentStatusPill } from "./EnrollmentStatusPill";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "enrollments.status.confirmed") return "Confirmed";
      if (key === "enrollments.status.pending") return "Pending";
      return key;
    },
  }),
}));

describe("EnrollmentStatusPill Component", () => {
  it("renders status label and semantic dot class for confirmed status", () => {
    const html = renderToStaticMarkup(<EnrollmentStatusPill status="confirmed" />);
    expect(html).toContain("Confirmed");
    expect(html).toContain("bg-success");
  });

  it("renders pending dot class and custom label", () => {
    const html = renderToStaticMarkup(
      <EnrollmentStatusPill status="pending" label="Awaiting Approval" />,
    );
    expect(html).toContain("Awaiting Approval");
    expect(html).toContain("bg-warning");
  });

  it("handles suspended and completed progression stages", () => {
    const suspendedHtml = renderToStaticMarkup(<EnrollmentStatusPill status="suspended" />);
    expect(suspendedHtml).toContain("bg-warning/80");

    const completedHtml = renderToStaticMarkup(<EnrollmentStatusPill status="completed" />);
    expect(completedHtml).toContain("bg-info");
  });
});
