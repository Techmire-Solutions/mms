import React from "react";
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { FilterChips } from "@/components/ui/FilterChips";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}`, dir: "ltr", language: "en" }),
}));

describe("FilterChips", () => {
  it("renders provided chips and clear-all when multiple chips exist", async () => {
    const onClearAll = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        <FilterChips
          chips={[
            { key: "gender", label: "Gender: Male", onRemove: () => undefined },
            { key: "status", label: "Status: Active", onRemove: () => undefined },
          ]}
          onClearAll={onClearAll}
        />,
      );
    });
    expect(container.textContent).toContain("Gender: Male");
    expect(container.textContent).toContain("Status: Active");
    expect(container.textContent).toContain("t:common.clearFilters");
    container.remove();
  });

  it("returns null when chips is empty", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(<FilterChips chips={[]} />);
    });
    expect(container.textContent).toBe("");
    container.remove();
  });
});
