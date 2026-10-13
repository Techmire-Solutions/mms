import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DistributionsListCards } from "./DistributionsListCards";
import type { DistributionsListContentProps } from "../lib/distributionsListShared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock("./DistributionsRowActions", () => ({
  DistributionsRowActions: () => <div data-testid="row-actions">Row Actions</div>,
}));

type Props = Omit<DistributionsListContentProps, "getColumnWidth" | "onColumnResize">;

const mockDenom = {
  id: "denom-1",
  name: "Gold Star",
  points: 10,
  icon: "⭐",
  color: "#f59e0b",
};

const mockDistribution = {
  id: "dist-1",
  recipientName: "Hamza Ali",
  recipientClass: "Class 3B",
  denominationId: "denom-1",
  denominationName: "Gold Star",
  quantity: 5,
  reason: "Excellent performance",
  issuedDate: "2025-04-01",
  issuedBy: "Teacher A",
  status: "active",
  deletedAt: null,
} as unknown as Props["distributions"][number];

const baseProps: Props = {
  viewMode: "cards" as const,
  distributions: [mockDistribution],
  denoms: [mockDenom] as unknown as Props["denoms"],
  selectedIds: [],
  allVisibleSelected: false,
  someVisibleSelected: false,
  isColumnVisible: () => true,
  statusLabels: { active: "Active", redeemed: "Redeemed", returned: "Returned" },
  statusConfig: {
    active: { label: "Active", tone: "success" },
    redeemed: { label: "Redeemed", tone: "warning" },
    returned: { label: "Returned", tone: "default" },
  } as unknown as Props["statusConfig"],
  canWrite: true,
  canDelete: true,
  showDeleted: false,
  canRestoreRows: false,
  canDeleteRows: true,
  onMessage: undefined,
  onChangeStatus: vi.fn(),
  onToggleSelectedDistribution: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onTrashAction: vi.fn(),
};

describe("DistributionsListCards", () => {
  it("renders recipient name", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} />);
    expect(html).toContain("Hamza Ali");
  });

  it("renders denomination icon and name in subtitle", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} />);
    expect(html).toContain("⭐");
    expect(html).toContain("Gold Star");
  });

  it("hides denomination subtitle when card column hidden", () => {
    const html = renderToStaticMarkup(
      <DistributionsListCards {...baseProps} isColumnVisible={(k) => k !== "card"} />,
    );
    expect(html).not.toContain("Gold Star");
  });

  it("renders metadata tiles for visible columns", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} />);
    expect(html).toContain("hasanat.columns.distribution.recipientClass");
    expect(html).toContain("hasanat.columns.distribution.quantity");
    expect(html).toContain("Class 3B");
  });

  it("renders quantity with bold styling", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} />);
    // quantity=5 in a <span class="font-bold">
    expect(html).toContain("font-bold");
    expect(html).toContain("5");
  });

  it("hides quantity tile when column hidden", () => {
    const html = renderToStaticMarkup(
      <DistributionsListCards {...baseProps} isColumnVisible={(k) => k !== "quantity"} />,
    );
    expect(html).not.toContain("hasanat.columns.distribution.quantity");
  });

  it("renders selection checkbox when canDelete=true", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} />);
    expect(html).toContain('type="checkbox"');
  });

  it("does not render checkbox when canDelete=false", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} canDelete={false} />);
    expect(html).not.toContain('type="checkbox"');
  });

  it("falls back to id as displayName when recipientName is absent", () => {
    const distWithoutName = { ...mockDistribution, recipientName: null };
    const html = renderToStaticMarkup(
      <DistributionsListCards
        {...baseProps}
        distributions={[distWithoutName] as unknown as Props["distributions"]}
      />,
    );
    expect(html).toContain("dist-1");
  });

  it("applies selected style when distribution is selected", () => {
    const html = renderToStaticMarkup(
      <DistributionsListCards {...baseProps} selectedIds={["dist-1"]} />,
    );
    expect(html).toContain("border-primary/50");
  });

  it("renders row actions", () => {
    const html = renderToStaticMarkup(<DistributionsListCards {...baseProps} />);
    expect(html).toContain("Row Actions");
  });
});
