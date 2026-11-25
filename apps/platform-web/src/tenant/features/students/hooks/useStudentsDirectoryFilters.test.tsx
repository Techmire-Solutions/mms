import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useStudentsDirectoryFilters } from "@/tenant/features/students/hooks/useStudentsDirectoryFilters";

const mocks = vi.hoisted(() => ({
  drillDown: null as { status?: string } | null,
  eventName: "students:work-drilldown",
}));

vi.mock("@/tenant/features/students/hooks/studentsWorkDrillDown", () => ({
  STUDENTS_WORK_DRILLDOWN_EVENT: "students:work-drilldown",
  consumeStudentsWorkDrillDown: () => mocks.drillDown,
}));

type Filters = ReturnType<typeof useStudentsDirectoryFilters>;

describe("useStudentsDirectoryFilters", () => {
  let container: HTMLDivElement;
  let root: Root;
  let filters: Filters;
  const setActiveTab = vi.fn();

  function renderFilters(): void {
    function TestComponent() {
      filters = useStudentsDirectoryFilters({ setActiveTab });
      return null;
    }
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/students"]}>
          <TestComponent />
        </MemoryRouter>,
      );
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setActiveTab.mockClear();
    mocks.drillDown = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("starts from the Work defaults with no active filters", () => {
    renderFilters();

    expect(filters.sortField).toBe("grNumber");
    expect(filters.sortDir).toBe("desc");
    expect(filters.quickFilter).toBe("all");
    expect(filters.studentFilterStatus).toEqual([]);
    expect(filters.hasActiveFilters).toBe(false);
    expect(filters.activeFilterCount).toBe(0);
    expect(filters.listPage).toBe(1);
  });

  it("toggles direction for the current sort and clears it for null", () => {
    renderFilters();

    act(() => filters.handleServerSort("name"));
    expect(filters.sortField).toBe("name");
    expect(filters.sortDir).toBe("asc");

    act(() => filters.handleServerSort("name"));
    expect(filters.sortDir).toBe("desc");

    // F-10: the Filters menu's "None" clears the sort instead of silently switching to name.
    act(() => filters.handleServerSort(null));
    expect(filters.sortField).toBeNull();
  });

  it("toggles status filters and supersedes any quick-filter preset", () => {
    renderFilters();

    act(() => filters.changeQuickFilter("graduated"));
    expect(filters.quickFilter).toBe("graduated");

    act(() => filters.toggleStudentStatus("active"));
    expect(filters.quickFilter).toBe("all");
    expect(filters.studentFilterStatus).toEqual(["active"]);

    act(() => filters.toggleStudentStatus("active"));
    expect(filters.studentFilterStatus).toEqual([]);
  });

  it("ignores an unknown quick-filter preset", () => {
    renderFilters();
    act(() => filters.changeQuickFilter("not-a-preset"));
    expect(filters.quickFilter).toBe("all");
  });

  it("treats the All genders sentinel as no filter", () => {
    // 2026-11-04 review (M1): the menu's "All genders" option used to write the
    // literal "all", which the API applied as an equality filter and emptied the list.
    renderFilters();

    act(() => filters.setStudentFilterGender("all"));

    expect(filters.studentFilterGender).toBe("");
    expect(filters.hasActiveFilters).toBe(false);
  });

  it("counts and clears active filters", () => {
    renderFilters();

    act(() => {
      filters.setStudentFilterGender("female");
      filters.toggleStudentStatus("active");
      filters.setStudentSearch("  ali ");
    });

    expect(filters.hasActiveFilters).toBe(true);
    expect(filters.activeFilterCount).toBeGreaterThanOrEqual(2);

    act(() => filters.clearFilters());
    expect(filters.studentFilterGender).toBe("");
    expect(filters.studentFilterStatus).toEqual([]);
    expect(filters.studentSearch).toBe("");
    expect(filters.quickFilter).toBe("all");
  });

  it("resets the page to 1 when the debounced search changes", () => {
    vi.useFakeTimers();
    renderFilters();

    act(() => filters.setListPage(3));
    expect(filters.listPage).toBe(3);

    act(() => filters.setStudentSearch("ali"));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(filters.debouncedSearch).toBe("ali");
    expect(filters.listPage).toBe(1);
  });

  it("manages selection including select-all on the page", () => {
    renderFilters();

    act(() => filters.handleSelectOne("s-1"));
    expect(filters.selectedIds).toEqual(["s-1"]);

    act(() => filters.handleSelectAll(["s-2", "s-3"]));
    expect(filters.selectedIds).toEqual(expect.arrayContaining(["s-2", "s-3"]));

    act(() => filters.clearSelection());
    expect(filters.selectedIds).toEqual([]);
  });

  it("clears the selection when the filter/search/sort view changes", () => {
    // M3: bulk delete/status/export bind to the selection, so it must not outlive the view that
    // produced it (contacts R4-06 parity) — otherwise the actions hit rows no longer on screen.
    vi.useFakeTimers();
    renderFilters();

    act(() => filters.handleSelectOne("s-1"));
    act(() => filters.toggleStudentStatus("graduated"));
    expect(filters.studentFilterStatus).toEqual(["graduated"]);
    expect(filters.selectedIds).toEqual([]);

    act(() => filters.handleSelectOne("s-2"));
    act(() => filters.handleServerSort("name"));
    expect(filters.selectedIds).toEqual([]);

    act(() => filters.handleSelectOne("s-3"));
    act(() => filters.setStudentSearch("ali"));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(filters.debouncedSearch).toBe("ali");
    expect(filters.selectedIds).toEqual([]);

    act(() => filters.handleSelectOne("s-4"));
    act(() => filters.toggleViewingDeleted());
    expect(filters.viewingDeleted).toBe(true);
    expect(filters.selectedIds).toEqual([]);
  });

  it("clears the selection when the page changes", () => {
    renderFilters();

    act(() => filters.handleSelectOne("s-1"));
    act(() => filters.setListPage(2));

    expect(filters.listPage).toBe(2);
    expect(filters.selectedIds).toEqual([]);
  });

  it("applies a drill-down event by switching to Work and setting the status", () => {
    renderFilters();

    act(() => {
      window.dispatchEvent(new CustomEvent(mocks.eventName, { detail: { status: "graduated" } }));
    });

    expect(filters.studentFilterStatus).toEqual(["graduated"]);
    expect(setActiveTab).toHaveBeenCalledWith("work");
  });

  it("seeds the status filter from a consumed drill-down on mount", () => {
    mocks.drillDown = { status: "active" };
    renderFilters();

    expect(filters.studentFilterStatus).toEqual(["active"]);
    expect(setActiveTab).toHaveBeenCalledWith("work");
  });
});
