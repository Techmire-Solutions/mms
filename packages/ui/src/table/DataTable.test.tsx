import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface MockRecord {
  id: string;
  name: string;
  role: string;
}

const mockColumns: DataTableColumn<MockRecord>[] = [
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "role", header: "Role", accessorKey: "role" },
];

const mockData: MockRecord[] = [
  { id: "1", name: "Alice", role: "Admin" },
  { id: "2", name: "Bob", role: "Operator" },
];

describe("DataTable component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders table data with columns and rows", async () => {
    await act(async () => {
      root.render(<DataTable data={mockData} columns={mockColumns} />);
    });

    expect(container.textContent).toContain("Name");
    expect(container.textContent).toContain("Role");
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
  });

  it("renders empty state when data is empty", async () => {
    await act(async () => {
      root.render(<DataTable data={[]} columns={mockColumns} />);
    });
    expect(container.textContent).toContain("No records found");
  });

  it("handles search input changes", async () => {
    const handleSearch = vi.fn();
    await act(async () => {
      root.render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          searchQuery=""
          onSearchChange={handleSearch}
          searchPlaceholder="Filter users..."
        />,
      );
    });

    const searchInput = container.querySelector(
      "input[placeholder='Filter users...']",
    ) as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(searchInput, "Alice");
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(handleSearch).toHaveBeenCalledWith("Alice");
  });

  it("handles pagination clicks", async () => {
    const handlePageChange = vi.fn();
    await act(async () => {
      root.render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          pagination={{
            currentPage: 1,
            totalPages: 3,
            onPageChange: handlePageChange,
          }}
        />,
      );
    });

    const nextBtn = container.querySelector("button[aria-label='Next']") as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    nextBtn.click();
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
