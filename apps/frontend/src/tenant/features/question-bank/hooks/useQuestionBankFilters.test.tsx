import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capturedQueries: Array<Record<string, unknown>> = [];

vi.mock("@/hooks/useDebounce", () => ({ useDebounce: (value: unknown) => value }));
vi.mock("./useQuestionBankQueries", () => ({
  useQuestionBankContractList: (query: Record<string, unknown>) => {
    capturedQueries.push(query);
    return { data: undefined };
  },
}));

import { useQuestionBankFilters } from "./useQuestionBankFilters";

describe("useQuestionBankFilters facets", () => {
  let container: HTMLDivElement;
  let root: Root;
  let current: ReturnType<typeof useQuestionBankFilters>;

  beforeEach(() => {
    capturedQueries.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function Host() {
      current = useQuestionBankFilters({});
      return null;
    }
    act(() => root.render(<Host />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("forwards the status and type facets to the server query", () => {
    act(() => current.setFilterStatus("approved"));
    act(() => current.setFilterType("mcq"));

    const latest = capturedQueries.at(-1);
    expect(latest).toMatchObject({ status: "approved", type: "mcq" });
  });

  it("omits empty facets and resets to the first page on change", () => {
    act(() => current.setListPage(3));
    act(() => current.setFilterStatus("draft"));

    const latest = capturedQueries.at(-1);
    expect(latest).toMatchObject({ page: 1, status: "draft" });
    expect(latest?.type).toBeUndefined();
  });
});
