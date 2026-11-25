import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useFacultyDirectoryFilterCatalog } from "./useFacultyDirectoryFilterCatalog";

const mocks = vi.hoisted(() => ({
  departments: [] as Array<Record<string, unknown>>,
  designations: [] as Array<Record<string, unknown>>,
  roster: [] as Array<Record<string, unknown>>,
}));

vi.mock("./useFacultyDepartments", () => ({
  useFacultyDepartments: () => ({ data: mocks.departments }),
}));

vi.mock("./useFacultyDesignations", () => ({
  useFacultyDesignations: () => ({ data: mocks.designations }),
}));

vi.mock("./useFacultyTsrQueries", () => ({
  useFacultyContractList: () => ({ data: { body: { faculty: mocks.roster } } }),
}));

type Catalog = ReturnType<typeof useFacultyDirectoryFilterCatalog>;

describe("useFacultyDirectoryFilterCatalog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let catalog: Catalog;

  function renderCatalog(): void {
    function TestComponent() {
      catalog = useFacultyDirectoryFilterCatalog(true);
      return null;
    }
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/faculty"]}>
          <TestComponent />
        </MemoryRouter>,
      );
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.departments = [];
    mocks.designations = [];
    mocks.roster = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("excludes inactive and soft-deleted catalog rows from directory filter options", () => {
    mocks.departments = [
      { name: "Active Dept", status: "active" },
      { name: "Inactive Dept", status: "inactive" },
      { name: "Deleted Dept", status: "active", deletedAt: "2026-01-01" },
    ];
    mocks.designations = [
      { name: "Active Desig", status: "active" },
      { name: "Inactive Desig", isActive: false },
    ];

    renderCatalog();

    expect(catalog.departmentFilterOptions.map((o) => o.label)).toEqual(["Active Dept"]);
    expect(catalog.designationFilterOptions.map((o) => o.label)).toEqual(["Active Desig"]);
  });
});
