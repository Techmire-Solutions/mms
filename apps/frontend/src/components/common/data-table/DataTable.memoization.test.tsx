import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";
import type { DataTableColumn } from "./dataTableTypes";

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
}

const initialRows: Row[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
  { id: "3", name: "Gamma" },
];

const extraRow: Row = { id: "4", name: "Delta" };

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("DataTable memoization", () => {
  let container: HTMLDivElement;
  let root: Root;
  let renderCount: number;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderCount = 0;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderHarness(): Promise<{
    rerender: () => void;
    addRow: () => void;
  }> {
    const renderName = (row: Row): string => {
      renderCount += 1;
      return row.name;
    };
    // Stable identities across renders, exactly like a well-behaved page.
    const columns: DataTableColumn<Row>[] = [
      { id: "name", label: "Name", fixed: true, render: renderName },
    ];

    const api = {
      rerender: () => {},
      addRow: () => {},
    };

    function Harness(): React.JSX.Element {
      const [rows, setRows] = React.useState<Row[]>(initialRows);
      const [, setTick] = React.useState(0);
      api.rerender = () => setTick((tick) => tick + 1);
      api.addRow = () => setRows((prev) => [...prev, extraRow]);

      return (
        <div>
          <button type="button" onClick={api.rerender}>
            rerender
          </button>
          <button type="button" onClick={api.addRow}>
            add-row
          </button>
          <DataTable<Row>
            tableId="memo.table"
            label="Memo table"
            data={rows}
            columns={columns}
            defaultViewMode="table"
          />
        </div>
      );
    }

    await act(async () => root.render(<Harness />));
    return api;
  }

  it("given an unrelated parent re-render, should not re-render table rows when mounted", async () => {
    // Arrange
    const api = await renderHarness();
    expect(renderCount).toBe(initialRows.length);

    // Act
    renderCount = 0;
    await act(async () => api.rerender());

    // Assert
    expect(renderCount).toBe(0);
  });

  it("given rows change, should render only the new row and keep search filtering working when mounted", async () => {
    // Arrange
    const api = await renderHarness();
    renderCount = 0;

    // Act
    await act(async () => api.addRow());

    // Assert
    expect(renderCount).toBe(1);
    expect(container.textContent).toContain("Delta");

    // Act: filtering still updates the visible rows (deferred search may settle a frame later).
    const searchInput = container.querySelector<HTMLInputElement>("input");
    expect(searchInput).not.toBeNull();
    await act(async () => {
      setInputValue(searchInput as HTMLInputElement, "Alpha");
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Alpha");
      expect(container.textContent).not.toContain("Delta");
    });
  });
});
