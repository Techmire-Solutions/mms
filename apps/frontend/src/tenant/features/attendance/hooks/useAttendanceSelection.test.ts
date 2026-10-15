import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { useAttendanceSelection } from "./useAttendanceSelection";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRecords: AttendanceRecord[] = [
  {
    id: "rec-1",
    studentId: "std-1",
    studentName: "Bilal",
    rollNo: "GR-001",
    classId: "cls-1",
    date: "2025-01-01",
    status: "present",
    timeIn: "08:00",
    timeOut: "12:00",
    notes: "",
    createdAt: "2025-01-01T08:00:00Z",
    updatedAt: "2025-01-01T08:00:00Z",
  },
  {
    id: "rec-2",
    studentId: "std-2",
    studentName: "Hamza",
    rollNo: "GR-002",
    classId: "cls-1",
    date: "2025-01-01",
    status: "absent",
    timeIn: "",
    timeOut: "",
    notes: "",
    createdAt: "2025-01-01T08:00:00Z",
    updatedAt: "2025-01-01T08:00:00Z",
  },
];

describe("useAttendanceSelection Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("selects individual records and all records", async () => {
    let hookResult!: ReturnType<typeof useAttendanceSelection>;

    function TestComponent() {
      hookResult = useAttendanceSelection(mockRecords);
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.selectedIds.length).toBe(0);

    await act(async () => {
      hookResult.toggleSelectedRecord("rec-1", true);
    });
    expect(hookResult.selectedIds).toEqual(["rec-1"]);
    expect(hookResult.someVisibleSelected).toBe(true);
    expect(hookResult.allVisibleSelected).toBe(false);

    await act(async () => {
      hookResult.toggleSelectAll(true);
    });
    expect(hookResult.selectedIds.length).toBe(2);
    expect(hookResult.allVisibleSelected).toBe(true);

    await act(async () => {
      hookResult.clearSelection();
    });
    expect(hookResult.selectedIds.length).toBe(0);
  });

  it("given an effect keyed on clearSelection, should settle without re-rendering when nothing is selected", async () => {
    // Arrange
    let renders = 0;
    const clearSelectionRefs = new Set<unknown>();
    function TestComponent() {
      renders += 1;
      const { clearSelection } = useAttendanceSelection(mockRecords);
      clearSelectionRefs.add(clearSelection);
      React.useEffect(() => {
        clearSelection();
      }, [clearSelection]);
      return null;
    }

    // Act
    await act(async () => {
      createRoot(container!).render(React.createElement(TestComponent));
    });

    // Assert
    expect(clearSelectionRefs.size).toBe(1);
    expect(renders).toBe(1);
  });
});
