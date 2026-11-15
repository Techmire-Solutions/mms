import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingPostingPeriodsSection } from "./AccountingPostingPeriodsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingLedgerOps", () => ({
  usePostingPeriods: () => ({
    data: [
      {
        id: "p-1",
        fiscalYearId: "fy-2026",
        label: "Nov 2026",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        status: "open",
      },
      {
        id: "p-2",
        fiscalYearId: "fy-2026",
        label: "Oct 2026",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        status: "closed",
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useClosePostingPeriod: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReopenPostingPeriod: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("AccountingPostingPeriodsSection", () => {
  it("lists periods with the matching close/reopen action", () => {
    const html = renderToStaticMarkup(
      <AccountingPostingPeriodsSection
        fiscalYears={[
          {
            id: "fy-2026",
            label: "2026",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            status: "active",
          },
        ]}
      />,
    );

    expect(html).toContain("accounting.settings.postingPeriods.title");
    expect(html).toContain("Nov 2026");
    expect(html).toContain("Oct 2026");
    expect(html).toContain("accounting.settings.postingPeriods.close");
    expect(html).toContain("accounting.settings.postingPeriods.reopen");
  });
});

describe("AccountingPostingPeriodsSection fiscal-year sync", () => {
  it("selects the latest fiscal year when the list arrives after mount", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<AccountingPostingPeriodsSection fiscalYears={[]} />);
      });
      await act(async () => {
        root.render(
          <AccountingPostingPeriodsSection
            fiscalYears={[
              {
                id: "fy-2026",
                label: "2026",
                startDate: "2026-01-01",
                endDate: "2026-12-31",
                status: "active",
              },
            ]}
          />,
        );
      });

      const selector = container.querySelector<HTMLSelectElement>("#posting-periods-fy");
      expect(selector?.value).toBe("fy-2026");
      expect(container.textContent).toContain("Nov 2026");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
