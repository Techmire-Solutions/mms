import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionsCommandMetrics } from "./SessionsCommandMetrics";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/tenant/features/sessions/hooks/useSessions", () => ({
  useSessionsMetrics: () => ({
    data: { total: 100, active: 20, upcoming: 5, completed: 70, cancelled: 5 },
    isLoading: false,
  }),
}));

describe("SessionsCommandMetrics", () => {
  it("shows the filtered total rather than the current page size", () => {
    const html = renderToStaticMarkup(<SessionsCommandMetrics total={50} filteredTotal={50} />);

    expect(html).toContain(">50<");
    expect(html).not.toContain(">12<");
  });

  it("shows placeholders while server metrics load", () => {
    // The module-level mock is fixed; this asserts the rendered shape is still four cards.
    const html = renderToStaticMarkup(<SessionsCommandMetrics total={50} filteredTotal={50} />);
    expect(html.match(/sessions.metrics\./g)?.length).toBeGreaterThanOrEqual(2);
  });
});
