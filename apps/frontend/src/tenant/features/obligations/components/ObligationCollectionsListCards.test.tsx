import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ObligationCollectionsListCards } from "./ObligationCollectionsListCards";
import type { ObligationCollectionListContentProps } from "./obligationCollectionListContentShared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock("./ObligationCollectionRowActions", () => ({
  ObligationCollectionRowActions: () => <div data-testid="row-actions">Row Actions</div>,
}));

type Props = Omit<
  ObligationCollectionListContentProps,
  "search" | "typeFilter" | "onAddNew" | "getColumnWidth" | "onColumnResize"
>;

const mockSender = { id: "contact-1", name: "Syed Ahmad" };
const mockObligationType = { id: "type-1", name: "Zakat" };

const mockCollection = {
  id: "col-1",
  receipt_no: "RC-2025-001",
  received_date: "2025-03-01",
  sender_id: "contact-1",
  obligation_type_id: "type-1",
  payment_mode: "cash",
  amount: 10000,
  currency: "PKR",
  deletedAt: null,
} as unknown as Props["collections"][number];

const baseProps: Props = {
  viewMode: "cards" as const,
  collections: [mockCollection],
  selectedIds: [],
  isColumnVisible: () => true,
  allVisibleSelected: false,
  someVisibleSelected: false,
  canWrite: true,
  canDelete: true,
  showDeleted: false,
  paymentModeConfig: {
    cash: { label: "Cash", tone: "success" },
  } as unknown as Props["paymentModeConfig"],
  getContact: ((id?: string | number | null) =>
    id === "contact-1" ? mockSender : undefined) as unknown as Props["getContact"],
  getRep: () => undefined,
  getMujtahid: () => undefined,
  getObligationType: (id: string) =>
    id === "type-1"
      ? {
          id: "type-1",
          name: "Zakat",
          quantity_based: false,
          designated_for: "Both" as const,
        }
      : undefined,
  onView: vi.fn(),
  onPrint: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onToggleSelectedCollection: vi.fn(),
  onTrashAction: vi.fn(),
  onMessage: undefined,
};

describe("ObligationCollectionsListCards", () => {
  it("renders sender name and receipt number", () => {
    const html = renderToStaticMarkup(<ObligationCollectionsListCards {...baseProps} />);
    expect(html).toContain("Syed Ahmad");
    expect(html).toContain("RC-2025-001");
  });

  it("renders metadata tiles for visible columns", () => {
    const html = renderToStaticMarkup(<ObligationCollectionsListCards {...baseProps} />);
    expect(html).toContain("obligations.columns.receivedDate");
    expect(html).toContain("obligations.columns.obligationType");
    expect(html).toContain("Zakat");
  });

  it("hides receivedDate tile when column hidden", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListCards
        {...baseProps}
        isColumnVisible={(k) => k !== "receivedDate"}
      />,
    );
    expect(html).not.toContain("obligations.columns.receivedDate");
  });

  it("renders print button when showDeleted=false", () => {
    const html = renderToStaticMarkup(<ObligationCollectionsListCards {...baseProps} />);
    expect(html).toContain("obligations.actions.printShort");
  });

  it("hides print button when showDeleted=true", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListCards {...baseProps} showDeleted={true} />,
    );
    // Print button hidden in trash mode
    expect(html).not.toContain("obligations.actions.printShort");
  });

  it("renders selection checkbox when canDelete=true", () => {
    const html = renderToStaticMarkup(<ObligationCollectionsListCards {...baseProps} />);
    expect(html).toContain('type="checkbox"');
  });

  it("does not render checkbox when canDelete=false", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListCards {...baseProps} canDelete={false} />,
    );
    expect(html).not.toContain('type="checkbox"');
  });

  it("falls back to dash when sender name absent", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListCards {...baseProps} getContact={() => undefined} />,
    );
    // EntityCard.Header displayName="—"
    expect(html).toContain("—");
  });

  it("renders view button in footer", () => {
    const html = renderToStaticMarkup(<ObligationCollectionsListCards {...baseProps} />);
    expect(html).toContain("obligations.actions.viewShort");
  });

  it("applies selected card style when collection is selected", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListCards {...baseProps} selectedIds={["col-1"]} />,
    );
    expect(html).toContain("border-primary/50");
  });

  it("renders row actions", () => {
    const html = renderToStaticMarkup(<ObligationCollectionsListCards {...baseProps} />);
    expect(html).toContain("Row Actions");
  });

  it("renders empty list without crashing", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListCards {...baseProps} collections={[]} />,
    );
    expect(html).toBeDefined();
  });
});
