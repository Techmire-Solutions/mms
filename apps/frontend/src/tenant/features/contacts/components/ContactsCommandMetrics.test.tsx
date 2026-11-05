import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsCommandMetrics } from "./ContactsCommandMetrics";

const metricsState = vi.hoisted(() => ({
  value: {
    data: {
      total: 100,
      newThisPeriod: 10,
      whatsappCount: 80,
      incompleteCount: 5,
      duplicatePairCount: 2,
    },
    isLoading: false,
  },
}));

vi.mock("@/tenant/features/contacts/hooks/useContacts", () => ({
  useContactsMetrics: () => metricsState.value,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleCommandMetricsGrid", () => ({
  ModuleCommandMetricsGrid: ({
    items,
  }: {
    items: Array<{ label: string; value: number | string; onClick?: () => void }>;
  }) => (
    <div data-testid="metrics-grid">
      {items.map((item) => (
        <div key={item.label}>
          <button type="button" onClick={item.onClick}>
            {item.label}
          </button>
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

describe("ContactsCommandMetrics duplicates + loading", () => {
  it("renders the potential-duplicates metric and opens the review", async () => {
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const onReviewDuplicates = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ContactsCommandMetrics
            shown={45}
            pendingCount={0}
            conflictCount={0}
            flushing={false}
            onReviewDuplicates={onReviewDuplicates}
          />,
        );
      });

      const button = Array.from(container.querySelectorAll("button")).find((node) =>
        node.textContent?.includes("contacts.metrics.duplicates"),
      );
      expect(button).toBeInstanceOf(HTMLButtonElement);
      await act(async () => {
        button?.click();
      });
      expect(onReviewDuplicates).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("shows placeholders instead of zeros while the metrics query loads", () => {
    metricsState.value = { ...metricsState.value, isLoading: true };

    const html = renderToStaticMarkup(
      <ContactsCommandMetrics shown={0} pendingCount={0} conflictCount={0} flushing={false} />,
    );

    expect(html).toContain("—");
    metricsState.value = { ...metricsState.value, isLoading: false };
  });
});
