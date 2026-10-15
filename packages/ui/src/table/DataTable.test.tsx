import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "./DataTable";

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
  it("renders table data with columns and rows", () => {
    render(<DataTable data={mockData} columns={mockColumns} />);

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Role")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("renders empty state when data is empty", () => {
    render(<DataTable data={[]} columns={mockColumns} />);
    expect(screen.getByText("No records found")).toBeDefined();
  });

  it("handles search input changes", () => {
    const handleSearch = vi.fn();
    render(
      <DataTable
        data={mockData}
        columns={mockColumns}
        searchQuery=""
        onSearchChange={handleSearch}
        searchPlaceholder="Filter users..."
      />,
    );

    const searchInput = screen.getByPlaceholderText("Filter users...");
    fireEvent.change(searchInput, { target: { value: "Alice" } });
    expect(handleSearch).toHaveBeenCalledWith("Alice");
  });

  it("handles pagination clicks", () => {
    const handlePageChange = vi.fn();
    render(
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

    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
