import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ExaminationsPageActions } from "./ExaminationsPageActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("ExaminationsPageActions", () => {
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
        <ExaminationsPageActions
          canWrite={true}
          canExport={true}
          showDeleted={false}
          onEnterMarks={vi.fn()}
          onCreateExam={vi.fn()}
          onImport={onImport}
          onExport={onExport}
        />,
      );
    });

    const exportBtn = container.querySelector("button:has(svg.lucide-download)");
    const importBtn = container.querySelector("button:has(svg.lucide-upload)");
    expect(exportBtn).toBeInstanceOf(HTMLButtonElement);
    expect(importBtn).toBeInstanceOf(HTMLButtonElement);

    exportBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onExport).toHaveBeenCalled();
  });

  it("shows a writer only the marks action, never exam definition controls", () => {
    act(() => {
      root.render(
        <ExaminationsPageActions
          canWrite={true}
          canManage={false}
          showDeleted={false}
          onEnterMarks={vi.fn()}
          onCreateExam={vi.fn()}
          onImport={vi.fn()}
        />,
      );
    });

    expect(container.querySelector("button:has(svg.lucide-pen-tool)")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(container.querySelector("button:has(svg.lucide-upload)")).toBeNull();
    expect(container.querySelector("button:has(svg.lucide-plus)")).toBeNull();
  });

  it("shows a controller the create and import actions", () => {
    act(() => {
      root.render(
        <ExaminationsPageActions
          canWrite={false}
          canManage={true}
          showDeleted={false}
          onEnterMarks={vi.fn()}
          onCreateExam={vi.fn()}
          onImport={vi.fn()}
        />,
      );
    });

    expect(container.querySelector("button:has(svg.lucide-upload)")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(container.querySelector("button:has(svg.lucide-plus)")).toBeInstanceOf(
      HTMLButtonElement,
    );
    // No marking authority: the marks action is hidden.
    expect(container.querySelector("button:has(svg.lucide-pen-tool)")).toBeNull();
  });
});
