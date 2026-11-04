import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useTaskSelectionScope } from "./useTaskSelectionScope";
import { buildTaskFilterScopeKey } from "../lib/taskFilterScope";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ScopeProbe({ scope, onClear }: { scope: string; onClear: () => void }) {
  useTaskSelectionScope(scope, onClear);
  return null;
}

describe("useTaskSelectionScope", () => {
  it("clears the selection when the visible window changes, and only then", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onClear = vi.fn();

    act(() => root.render(<ScopeProbe scope="all|||" onClear={onClear} />));
    expect(onClear).not.toHaveBeenCalled();

    act(() => root.render(<ScopeProbe scope="open|zaid||" onClear={onClear} />));
    expect(onClear).toHaveBeenCalledTimes(1);

    act(() => root.render(<ScopeProbe scope="open|zaid||" onClear={onClear} />));
    expect(onClear).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });
});

describe("buildTaskFilterScopeKey", () => {
  it("is order-insensitive for multi-selects and changes with every input", () => {
    const base = {
      quickFilter: "all",
      search: "",
      statusFilter: ["todo", "blocked"],
      priorityFilter: ["high"],
      dueFrom: "2026-01-01",
      dueTo: "2026-01-31",
      page: 2,
    };

    const first = buildTaskFilterScopeKey(base);
    expect(buildTaskFilterScopeKey({ ...base, statusFilter: ["blocked", "todo"] })).toBe(first);
    expect(buildTaskFilterScopeKey({ ...base, search: "exam" })).not.toBe(first);
    expect(buildTaskFilterScopeKey({ ...base, quickFilter: "overdue" })).not.toBe(first);
    expect(buildTaskFilterScopeKey({ ...base, page: 3 })).not.toBe(first);
  });
});
