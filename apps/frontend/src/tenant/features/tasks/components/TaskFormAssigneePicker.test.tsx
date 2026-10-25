import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TaskFormAssigneePicker } from "./TaskFormAssigneePicker";
import type { EligibleAssigneeItem } from "../hooks/useTasksApi";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string, p?: { name?: string }) => {
      if (k === "tasks.assigneeSelf") return "Self";
      if (k === "tasks.removeAssignee" && p?.name) return `Remove ${p.name}`;
      return k;
    },
  }),
}));

describe("TaskFormAssigneePicker", () => {
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

  const mockEligible: EligibleAssigneeItem[] = [
    {
      facultyId: "fac-1",
      name: "Ahmad Khan",
      departmentName: "Islamic Studies",
      userId: "u-1",
      isSelf: false,
    },
    {
      facultyId: "fac-2",
      name: "Fatima Ali",
      departmentName: "Mathematics",
      userId: "u-2",
      isSelf: true,
    },
  ];

  it("renders eligible options with department and self tags", () => {
    act(() => {
      root.render(
        <TaskFormAssigneePicker
          eligibleList={mockEligible}
          selectedAssignees={[]}
          onAddAssignee={vi.fn()}
          onRemoveAssignee={vi.fn()}
        />,
      );
    });

    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    const options = Array.from(select?.options ?? []).map((o) => o.text);
    expect(options).toContain("Ahmad Khan (Islamic Studies)");
    expect(options).toContain("Fatima Ali (Mathematics) • Self");
  });

  it("filters out already selected assignees from options", () => {
    act(() => {
      root.render(
        <TaskFormAssigneePicker
          eligibleList={mockEligible}
          selectedAssignees={[{ facultyId: "fac-1", name: "Ahmad Khan" }]}
          onAddAssignee={vi.fn()}
          onRemoveAssignee={vi.fn()}
        />,
      );
    });

    const select = container.querySelector("select");
    const options = Array.from(select?.options ?? []).map((o) => o.text);
    expect(options).not.toContain("Ahmad Khan (Islamic Studies)");
    expect(options).toContain("Fatima Ali (Mathematics) • Self");
  });

  it("renders badge and triggers onRemoveAssignee when remove button clicked", () => {
    const onRemove = vi.fn();

    act(() => {
      root.render(
        <TaskFormAssigneePicker
          eligibleList={mockEligible}
          selectedAssignees={[{ facultyId: "fac-1", name: "Ahmad Khan" }]}
          onAddAssignee={vi.fn()}
          onRemoveAssignee={onRemove}
        />,
      );
    });

    expect(container.textContent).toContain("Ahmad Khan");
    const removeBtn = container.querySelector('button[aria-label="Remove Ahmad Khan"]');
    expect(removeBtn).toBeTruthy();

    act(() => {
      removeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRemove).toHaveBeenCalledWith("fac-1");
  });
});
