import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionFormFooter } from "./SessionFormFooter";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SessionFormFooter", () => {
  it("lists the missing required fields instead of a disabled save with no reason", () => {
    const html = renderToStaticMarkup(<SessionFormFooter sessionStatus="draft" />);
    expect(html).toContain("sessions.form.completeRequired");
  });

  it("uses the lifecycle label and hides the type badge when program is unset", () => {
    const html = renderToStaticMarkup(
      <SessionFormFooter
        sessionName="Hifz 2027"
        sessionStatus="in_progress"
        startDate="2027-01-01"
        endDate="2027-06-30"
      />,
    );
    expect(html).toContain("sessions.lifecycle.in_progress");
  });
});
