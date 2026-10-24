import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useWorkBatchTableInternalState } from "./useWorkBatchTableInternalState";
import type { WorkBatchTableColumn } from "./workBatchTableTypes";

interface TestRow {
  id: string;
  name: string;
  age: number;
}

const testColumns: WorkBatchTableColumn<TestRow>[] = [
  { id: "name", label: "Name", render: (r) => r.name },
  { id: "age", label: "Age", render: (r) => r.age },
];

const testData: TestRow[] = [
  { id: "1", name: "Zaid", age: 25 },
  { id: "2", name: "Ali", age: 30 },
  { id: "3", name: "Bilal", age: 20 },
];

function renderHookWrapper() {
  let hookResult!: ReturnType<typeof useWorkBatchTableInternalState<TestRow>>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useWorkBatchTableInternalState({
      data: testData,
      columns: testColumns,
    });
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    getResult: () => hookResult,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useWorkBatchTableInternalState", () => {
  it("sorts data ascending and descending when internally controlled", () => {
    const { getResult, cleanup } = renderHookWrapper();
    try {
      expect(getResult().sortedData.map((r) => r.name)).toEqual(["Zaid", "Ali", "Bilal"]);

      act(() => {
        getResult().sortConfig.onSort("name");
      });
      expect(getResult().sortConfig.field).toBe("name");
      expect(getResult().sortConfig.dir).toBe("asc");
      expect(getResult().sortedData.map((r) => r.name)).toEqual(["Ali", "Bilal", "Zaid"]);

      act(() => {
        getResult().sortConfig.onSort("name");
      });
      expect(getResult().sortConfig.dir).toBe("desc");
      expect(getResult().sortedData.map((r) => r.name)).toEqual(["Zaid", "Bilal", "Ali"]);
    } finally {
      cleanup();
    }
  });

  it("manages column widths internally when columnResize is not provided", () => {
    const { getResult, cleanup } = renderHookWrapper();
    try {
      expect(getResult().columnResizeConfig.getColumnWidth("name")).toBeUndefined();

      act(() => {
        getResult().columnResizeConfig.onColumnResize?.("name", 220);
      });

      expect(getResult().columnResizeConfig.getColumnWidth("name")).toBe(220);
    } finally {
      cleanup();
    }
  });
});
