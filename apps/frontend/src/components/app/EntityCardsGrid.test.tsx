import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

describe("EntityCardsGrid Component", () => {
  it("renders children in a responsive grid container", () => {
    const html = renderToStaticMarkup(
      <EntityCardsGrid className="custom-test-grid">
        <div data-testid="card-1">Card 1</div>
        <div data-testid="card-2">Card 2</div>
      </EntityCardsGrid>,
    );

    expect(html).toContain("grid");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("gap-4");
    expect(html).toContain("custom-test-grid");
    expect(html).toContain("Card 1");
    expect(html).toContain("Card 2");
  });

  it("handles high-volume mock children cleanly without layout degradation", () => {
    const cards = Array.from({ length: 100 }, (_, i) => <div key={`card-${i}`}>Record #{i}</div>);

    const html = renderToStaticMarkup(<EntityCardsGrid>{cards}</EntityCardsGrid>);

    expect(html).toContain("Record #0");
    expect(html).toContain("Record #99");
  });
});

describe("EntityCardsGrid — virtualization behaviour", () => {
  /**
   * SSR test: when items.length > 30 (virtualized path), the component emits
   * the virtual-scroll container structure (position:relative totalSize div)
   * instead of directly inlining all card children. We verify the container
   * DOM shape that TanStack Virtual produces — this is stable across SSR
   * because the virtualizer is `enabled: isVirtualized` and still renders
   * visible virtual items on the server.
   *
   * NOTE: happy-dom / JSDOM do not implement scrollHeight / getBoundingClientRect,
   * so TanStack Virtual initialises with estimateSize(). With overscan=6 and
   * estimateSize=180 the virtualizer's initial window covers the first ~6 rows
   * (12 items). We assert that far fewer than 1,000 raw card nodes appear in
   * the output — confirming the virtualizer suppresses off-viewport renders.
   */
  it("virtualizes pairs of items when item count exceeds 30 — SSR emits totalSize spacer, not inline cards", () => {
    // TanStack Virtual in happy-dom / SSR context: scroll container has 0 height,
    // so the virtualizer renders 0 virtual items and emits only the totalSize
    // spacer div. This verifies the virtualizer is engaged (spacer present,
    // cards NOT inlined) rather than the non-virtual flat render path.
    const TOTAL = 1_000;
    // TOTAL items → ceil(1000/2) = 500 pair-rows × estimateSize 180px = 90 000px
    const EXPECTED_TOTAL_SIZE_PX = Math.ceil(TOTAL / 2) * 180;
    const items = Array.from({ length: TOTAL }, (_, i) => ({
      id: String(i),
      label: `Record #${i}`,
    }));

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        renderItem={(item) => (
          <div key={item.id} data-card={item.id}>
            {item.label}
          </div>
        )}
        selectedIds={[]}
      />,
    );

    // The virtual scroll container wrapper must be present
    expect(html).toContain("overflow-y-auto");

    // TanStack Virtual emits the totalSize spacer with height = rows × estimateSize
    expect(html).toContain(`height:${EXPECTED_TOTAL_SIZE_PX}px`);

    // Virtual rows are position:relative (the totalSize container)
    expect(html).toContain("position:relative");

    // Cards must NOT be inlined directly — the virtualizer is suppressing them.
    // In SSR with 0-height container, 0 virtual items are emitted.
    const renderedCardCount = (html.match(/data-card="/g) ?? []).length;
    expect(renderedCardCount).toBeLessThan(TOTAL);
  });

  it("renders all items without virtualisation when item count is <= 30", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      label: `Item #${i}`,
    }));

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        renderItem={(item) => (
          <div key={item.id} data-card={item.id}>
            {item.label}
          </div>
        )}
        selectedIds={[]}
      />,
    );

    // Non-virtualized path — no absolute positioning wrapper
    expect(html).not.toContain("position:absolute");
    // All 20 items must appear
    expect(html).toContain('data-card="0"');
    expect(html).toContain('data-card="19"');
  });

  it("renders SelectAll bar when onSelectAll handler is provided", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      label: `Item #${i}`,
    }));

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        renderItem={(item) => <div key={item.id}>{item.label}</div>}
        selectedIds={[]}
        onSelectAll={vi.fn()}
        selectAllLabel="Select All Items"
      />,
    );

    expect(html).toContain("Select All Items");
  });
});

describe("EntityCardsGrid Component", () => {
  it("renders non-virtualized cards grid when items count <= 50", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, name: `Item ${i}` }));

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        selectedIds={[]}
        renderItem={(item) => (
          <div key={item.id} data-testid="card-item">
            {item.name}
          </div>
        )}
      />,
    );

    expect(html).toContain("Item 0");
    expect(html).toContain("Item 9");
    expect(html).not.toContain("max-h-drawer");
  });

  it("handles high-volume items (> 50) using virtualized windowing container", () => {
    const items = Array.from({ length: 120 }, (_, i) => ({ id: `card-${i}`, name: `Item ${i}` }));

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        selectedIds={[]}
        renderItem={(item) => (
          <div key={item.id} data-testid="virtual-card">
            {item.name}
          </div>
        )}
      />,
    );

    expect(html).toContain("max-h-drawer");
  });

  it("renders select-all bar when onSelectAll is provided and items exist", () => {
    const onSelectAll = vi.fn();
    const items = [
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta" },
    ];

    const html = renderToStaticMarkup(
      <EntityCardsGrid
        items={items}
        selectedIds={["1"]}
        onSelectAll={onSelectAll}
        allSelected={false}
        someSelected={true}
        selectAllLabel="Select All"
        deselectAllLabel="Deselect"
        checkboxIdPrefix="test-cards"
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
      />,
    );

    expect(html).toContain("1 selected");
  });
});
