import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsCommandMetrics } from "./ContactsCommandMetrics";

vi.mock("@/tenant/features/contacts/hooks/useContacts", () => ({
  useContactsMetrics: () => ({
    data: {
      total: 100,
      newThisPeriod: 10,
      whatsappCount: 80,
      incompleteCount: 5,
      duplicatePairCount: 2,
    },
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/ModuleCommandMetricsGrid", () => ({
  ModuleCommandMetricsGrid: ({ items }: { items: Array<{ label: string; value: number }> }) => (
    <div data-testid="metrics-grid">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  ),
}));

describe("ContactsCommandMetrics Component", () => {
  it("renders metrics grid items for total, filtered, pending sync, and sync conflicts", () => {
    const html = renderToStaticMarkup(
      <ContactsCommandMetrics shown={45} pendingCount={3} conflictCount={1} flushing={false} />,
    );

    expect(html).toContain("contacts.metrics.total");
    expect(html).toContain("100");
    expect(html).toContain("contacts.metrics.filtered");
    expect(html).toContain("45");
    expect(html).toContain("contacts.metrics.pendingSync");
    expect(html).toContain("3");
    expect(html).toContain("contacts.metrics.syncConflicts");
    expect(html).toContain("1");
  });
});
