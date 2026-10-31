import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TasksPageHeaderActions } from "./TasksPageHeaderActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("TasksPageHeaderActions", () => {
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

  it("renders both Export and Import buttons when canWrite and canExport", () => {
    const onExport = vi.fn();
    const onImport = vi.fn();

    act(() => {
      root.render(
        <TasksPageHeaderActions
          canWrite={true}
          canExport={true}
          showDeleted={false}
          onCreate={vi.fn()}
          onImport={onImport}
          onExport={onExport}
        />,
      );
    });

    const exportBtn = container.querySelector("button:has(svg.lucide-download)");
    const importBtn = container.querySelector("button:has(svg.lucide-upload)");
    expect(exportBtn).toBeTruthy();
    expect(importBtn).toBeTruthy();

    exportBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onExport).toHaveBeenCalled();
  });

  it("renders Export button but hides Create and Import when read-only with export rights", () => {
    const onExport = vi.fn();
    const onImport = vi.fn();

    act(() => {
      root.render(
        <TasksPageHeaderActions
          canWrite={false}
          canExport={true}
          showDeleted={false}
          onCreate={vi.fn()}
          onImport={onImport}
          onExport={onExport}
        />,
      );
    });

    const exportBtn = container.querySelector("button:has(svg.lucide-download)");
    const importBtn = container.querySelector("button:has(svg.lucide-upload)");
    const createBtn = container.querySelector("button:has(svg.lucide-plus)");
    expect(exportBtn).toBeTruthy();
    expect(importBtn).toBeNull();
    expect(createBtn).toBeNull();

    exportBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onExport).toHaveBeenCalled();
  });

  it("renders null when in trash view", () => {
    act(() => {
      root.render(
        <TasksPageHeaderActions
          canWrite={true}
          canExport={true}
          showDeleted={true}
          onCreate={vi.fn()}
          onImport={vi.fn()}
          onExport={vi.fn()}
        />,
      );
    });

    expect(container.innerHTML).toBe("");
  });
});
