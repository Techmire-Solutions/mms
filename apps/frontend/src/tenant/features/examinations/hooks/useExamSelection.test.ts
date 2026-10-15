import { describe, expect, it, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useExamSelection } from "./useExamSelection";
import type { Exam } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockExams: Exam[] = [
  {
    id: "ex-1",
    name: "Midterm",
    subject: "Tajweed",
    date: "2025-01-01",
    duration: 60,
    totalMarks: 100,
    passingMarks: 50,
    classIds: ["cls-1"],
    status: "upcoming",
    description: "",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "ex-2",
    name: "Final",
    subject: "Hifz",
    date: "2025-01-02",
    duration: 60,
    totalMarks: 100,
    passingMarks: 50,
    classIds: ["cls-2"],
    status: "upcoming",
    description: "",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

describe("useExamSelection Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("handles selection, select all, toggle, and clear", async () => {
    let hookResult!: ReturnType<typeof useExamSelection>;

    function TestComponent() {
      hookResult = useExamSelection(mockExams);
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.selectedIds).toEqual([]);
    expect(hookResult.allVisibleSelected).toBe(false);

    // Toggle single exam
    await act(async () => {
      hookResult.toggleSelectedExam("ex-1", true);
    });
    expect(hookResult.selectedIds).toEqual(["ex-1"]);
    expect(hookResult.someVisibleSelected).toBe(true);
    expect(hookResult.allVisibleSelected).toBe(false);

    // Select all
    await act(async () => {
      hookResult.toggleSelectAll(true);
    });
    expect(hookResult.selectedIds).toEqual(["ex-1", "ex-2"]);
    expect(hookResult.allVisibleSelected).toBe(true);

    // Clear selection
    await act(async () => {
      hookResult.clearSelection();
    });
    expect(hookResult.selectedIds).toEqual([]);
  });
});
