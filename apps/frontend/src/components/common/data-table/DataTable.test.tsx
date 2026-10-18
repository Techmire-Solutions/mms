import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";
import type { DataTableColumn, DataTableFilter } from "./dataTableTypes";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface Row {
  id: string;
  name: string;
  status: "active" | "inactive";
}

const rows: Row[] = [
  { id: "1", name: "Alpha", status: "active" },
  { id: "2", name: "Beta", status: "inactive" },
  { id: "3", name: "Gamma", status: "active" },
];

const columns: DataTableColumn<Row>[] = [
  { id: "name", label: "Name", fixed: true, render: (r) => r.name },
  { id: "status", label: "Status", render: (r) => r.status },
];

const filters: DataTableFilter<Row>[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    getValue: (r) => r.status,
  },
];

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DataTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const renderTable = async (props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) => {
    await act(async () => {
      root.render(
        <DataTable<Row>
          tableId="test.table"
          label="Test table"
          data={rows}
          columns={columns}
          filters={filters}
          defaultViewMode="table"
          {...props}
        />,
      );
    });
  };

  it("renders the shared toolbar controls and all rows", async () => {
    await renderTable();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(container.querySelector('input[type="search"], input')).not.toBeNull();
    expect(container.querySelector('[aria-label="common.viewMode.group"]')).not.toBeNull();
    expect(container.textContent).toContain("common.filters");
    expect(container.textContent).toContain("common.columns.trigger");
  });

  it("filters rows by search across visible columns and shows a clearable no-match state", async () => {
    await renderTable();
    const input = container.querySelector<HTMLInputElement>("input")!;
    await act(async () => setInputValue(input, "inactive"));
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.textContent).toContain("Beta");

    await act(async () => setInputValue(input, "zzz"));
    expect(container.textContent).toContain("common.dataTable.noMatches");
  });

  it("switches to card view", async () => {
    await renderTable({ defaultViewMode: "cards" });
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Status");
  });

  it("renders the provided empty state when there is no data", async () => {
    await renderTable({ data: [], emptyState: <p>nothing yet</p> });
    expect(container.textContent).toContain("nothing yet");
  });
});
