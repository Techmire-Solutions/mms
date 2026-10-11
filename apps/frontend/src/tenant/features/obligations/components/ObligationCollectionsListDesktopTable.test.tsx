import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ObligationCollectionsListDesktopTable } from "./ObligationCollectionsListDesktopTable";
import type { ObligationCollection } from "@/lib/data/obligationsData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationLookups", () => ({
  useMergedObligationUsers: () => [
    { id: "user-123", name: "Molana Ali", loginEmail: "ali@example.com" },
  ],
}));

vi.mock("./ObligationCollectionRowActions", () => ({
  ObligationCollectionRowActions: () => <div data-testid="row-actions">Row Actions</div>,
}));

const mockCollectionWithResolvedUser: ObligationCollection = {
  id: "col-1",
  receipt_no: "OBL-00001",
  received_date: "2026-09-12",
  sender_id: "contact-1",
  obligation_type_id: "type-1",
  payment_mode: "cash",
  amount: 10000,
  currency_id: "PKR",
  received_by: "user-123",
  deletedAt: null,
} as unknown as ObligationCollection;

const mockCollectionWithUnknownUser: ObligationCollection = {
  id: "col-2",
  receipt_no: "OBL-00002",
  received_date: "2026-09-12",
  sender_id: "contact-2",
  obligation_type_id: "type-1",
  payment_mode: "cash",
  amount: 5000,
  currency_id: "PKR",
  received_by: "unknown-uuid-456",
  deletedAt: null,
} as unknown as ObligationCollection;

const baseProps = {
  selectedIds: [],
  viewMode: "table" as const,
  isColumnVisible: () => true,
  allVisibleSelected: false,
  someVisibleSelected: false,
  canWrite: true,
  canDelete: true,
  showDeleted: false,
  paymentModeConfig: {
    cash: { label: "Cash", tone: "success", cls: "bg-success" },
  },
  getContact: () => undefined,
  getRep: () => undefined,
  getMujtahid: () => undefined,
  getObligationType: () => undefined,
  onView: vi.fn(),
  onPrint: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onToggleSelectedCollection: vi.fn(),
  onTrashAction: vi.fn(),
  onMessage: vi.fn(),
};

describe("ObligationCollectionsListDesktopTable", () => {
  it("resolves and renders user display name in Received by column", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListDesktopTable
        {...baseProps}
        collections={[mockCollectionWithResolvedUser]}
      />,
    );

    expect(html).toContain("Molana Ali");
    expect(html).not.toContain("user-123");
  });

  it("falls back to raw identifier when user is not found in lookup", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListDesktopTable
        {...baseProps}
        collections={[mockCollectionWithUnknownUser]}
      />,
    );

    expect(html).toContain("unknown-uuid-456");
  });

  it("renders compact actions header label and selection elements", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionsListDesktopTable
        {...baseProps}
        collections={[mockCollectionWithResolvedUser]}
      />,
    );

    expect(html).toContain("common.actions");
    expect(html).toContain("w-24 min-w-24 text-end");
  });
});
