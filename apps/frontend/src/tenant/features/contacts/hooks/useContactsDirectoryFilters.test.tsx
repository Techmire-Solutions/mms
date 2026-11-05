import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useContactsDirectoryFilters } from "@/tenant/features/contacts/hooks/useContactsDirectoryFilters";

type Filters = ReturnType<typeof useContactsDirectoryFilters>;

/**
 * R4-06: bulk delete/tag/export bind to the visible directory, so a selection must
 * not survive the filter/search/sort/page/trash change that hid its rows.
 */
describe("useContactsDirectoryFilters selection scope", () => {
  let container: HTMLDivElement;
  let root: Root;
  let filters: Filters;

  function renderFilters(): void {
    function TestComponent() {
      filters = useContactsDirectoryFilters({ setActiveTab: () => undefined });
      return null;
    }
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/contacts"]}>
          <TestComponent />
        </MemoryRouter>,
      );
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderFilters();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps a selection while the list stays the same", () => {
    act(() => filters.handleSelect("c-1"));
    expect(filters.selected).toEqual(["c-1"]);
  });

  it("clears the selection when a filter changes", () => {
    act(() => filters.handleSelect("c-1"));
    act(() => filters.handleSelect("c-2"));
    act(() => filters.setFilterGender("female"));

    expect(filters.selected).toEqual([]);
  });

  it("clears the selection when the quick filter changes", () => {
    act(() => filters.handleSelect("c-1"));
    act(() => filters.setQuickFilter("missingInfo"));

    expect(filters.selected).toEqual([]);
  });

  it("clears the selection when the page changes", () => {
    act(() => filters.handleSelect("c-1"));
    act(() => filters.setListPage(3));

    expect(filters.selected).toEqual([]);
  });

  it("clears the selection when the trash view is toggled", () => {
    act(() => filters.handleSelect("c-1"));
    act(() => filters.setViewingDeleted(true));

    expect(filters.selected).toEqual([]);
  });

  it("keeps select-all limited to the page it was applied on", () => {
    act(() => filters.handleSelectAll(["c-1", "c-2"]));
    expect(filters.selected).toEqual(["c-1", "c-2"]);

    act(() => filters.handleSelectAll(["c-1", "c-2"]));
    expect(filters.selected).toEqual([]);
  });
});

describe("useContactsDirectoryFilters sort direction", () => {
  let container: HTMLDivElement;
  let root: Root;
  let filters: Filters;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function TestComponent() {
      filters = useContactsDirectoryFilters({ setActiveTab: () => undefined });
      return null;
    }
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/contacts"]}>
          <TestComponent />
        </MemoryRouter>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("changes direction explicitly and returns to page 1", () => {
    act(() => filters.setListPage(3));
    act(() => filters.handleSortDir("desc"));

    expect(filters.sortDir).toBe("desc");
    expect(filters.sortField).toBe("name");
    expect(filters.listPage).toBe(1);
  });

  it("keeps the toggle behaviour of the table header", () => {
    act(() => filters.handleSort("name"));
    expect(filters.sortDir).toBe("desc");

    act(() => filters.handleSort("createdAt"));
    expect(filters.sortField).toBe("createdAt");
    expect(filters.sortDir).toBe("asc");
  });
});
