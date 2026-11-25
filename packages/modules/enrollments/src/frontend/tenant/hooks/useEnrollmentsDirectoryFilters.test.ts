import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useEnrollmentsDirectoryFilters } from "./useEnrollmentsDirectoryFilters";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let hookResult: ReturnType<typeof useEnrollmentsDirectoryFilters> | null = null;

function TestComponent(): React.JSX.Element {
  hookResult = useEnrollmentsDirectoryFilters();
  return React.createElement("div");
}

describe("useEnrollmentsDirectoryFilters hook", () => {
  it("initializes with default filters and clears them", async () => {
    const root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(TestComponent)));
    });

    expect(hookResult?.listPage).toBe(1);
    expect(hookResult?.search).toBe("");
    expect(hookResult?.statusFilter).toBe("all");
    expect(hookResult?.sessionFilter).toBe("all");
    expect(hookResult?.hasActiveFilters).toBe(false);

    await act(async () => {
      hookResult?.setSearch("Ali");
      hookResult?.setStatusFilter("confirmed");
    });

    expect(hookResult?.hasActiveFilters).toBe(true);

    await act(async () => {
      hookResult?.clearFilters();
    });

    expect(hookResult?.search).toBe("");
    expect(hookResult?.statusFilter).toBe("all");
    expect(hookResult?.hasActiveFilters).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
