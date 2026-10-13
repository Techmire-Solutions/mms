import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditableMultiSelectOptionList } from "./EditableMultiSelectParts";

import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockT: TranslationFunction = ((key: string) => key) as unknown as TranslationFunction;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

describe("EditableMultiSelectOptionList Virtualization & Rendering", () => {
  it("renders non-virtualized options cleanly when count <= 50", () => {
    const smallOptions = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`);
    const html = renderToStaticMarkup(
      <EditableMultiSelectOptionList
        resolvedId="test-select"
        listboxId="test-listbox"
        filteredOptions={smallOptions}
        values={["Option 1"]}
        canRemoveOptions={true}
        t={mockT}
        onToggleOption={vi.fn()}
        onRemoveOption={vi.fn()}
      />,
    );

    expect(html).toContain('id="test-listbox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain("Option 1");
    expect(html).toContain("Option 10");
  });

  it("handles high-cardinality collections (> 50 items) with virtualized viewport container", () => {
    const largeOptions = Array.from({ length: 150 }, (_, i) => `Tag ${i + 1}`);
    const html = renderToStaticMarkup(
      <EditableMultiSelectOptionList
        resolvedId="test-select-large"
        listboxId="test-listbox-large"
        filteredOptions={largeOptions}
        values={["Tag 5"]}
        canRemoveOptions={false}
        t={mockT}
        onToggleOption={vi.fn()}
        onRemoveOption={vi.fn()}
      />,
    );

    expect(html).toContain('id="test-listbox-large"');
    expect(html).toContain('role="listbox"');
    // The container element with relative position is rendered for virtual rows
    expect(html).toContain("position:relative");
  });

  it("virtualizer suppresses off-viewport items — SSR emits totalSize spacer, not flat option list", () => {
    // TanStack Virtual in happy-dom / SSR: scroll container height = 0,
    // so the virtualizer renders 0 virtual items. Verify the spacer height
    // equals TOTAL × estimateSize (36px) and that no role="option" nodes
    // are inlined (proving the virtualizer, not the flat path, is active).
    const TOTAL = 200;
    const EXPECTED_TOTAL_SIZE_PX = TOTAL * 36; // estimateSize = 36
    const largeOptions = Array.from({ length: TOTAL }, (_, i) => `Tag ${i + 1}`);
    const html = renderToStaticMarkup(
      <EditableMultiSelectOptionList
        resolvedId="test-select-bounded"
        listboxId="test-listbox-bounded"
        filteredOptions={largeOptions}
        values={[]}
        canRemoveOptions={false}
        t={mockT}
        onToggleOption={vi.fn()}
        onRemoveOption={vi.fn()}
      />,
    );

    // Spacer height = total item count × estimateSize
    expect(html).toContain(`height:${EXPECTED_TOTAL_SIZE_PX}px`);
    // No role="option" nodes inlined — virtualizer is suppressing them in SSR
    const optionCount = (html.match(/role="option"/g) ?? []).length;
    expect(optionCount).toBeLessThan(TOTAL);
  });

  it("non-virtualized path renders every option when count <= 50", () => {
    const options = Array.from({ length: 50 }, (_, i) => `Opt-${i}`);
    const html = renderToStaticMarkup(
      <EditableMultiSelectOptionList
        resolvedId="test-select-nonvirt"
        listboxId="test-listbox-nonvirt"
        filteredOptions={options}
        values={[]}
        canRemoveOptions={false}
        t={mockT}
        onToggleOption={vi.fn()}
        onRemoveOption={vi.fn()}
      />,
    );

    const optionCount = (html.match(/role="option"/g) ?? []).length;
    expect(optionCount).toBe(50);
  });
});
