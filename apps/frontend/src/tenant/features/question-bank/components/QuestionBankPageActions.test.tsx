import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QuestionBankPageActions } from "./QuestionBankPageActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("QuestionBankPageActions", () => {
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
        <QuestionBankPageActions
          canWrite={true}
          canExport={true}
          showDeleted={false}
          onCreatePaper={vi.fn()}
          onAddQuestion={vi.fn()}
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
});
