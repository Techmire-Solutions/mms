import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

const hookCalls: Array<Record<string, unknown>> = [];
const hookState = {
  isOpen: true,
  setIsOpen: vi.fn(),
  fileName: "",
  parsedRows: [] as unknown[],
  missingHeaders: [] as string[],
  rowErrors: [] as Array<{ row: number; error: string }>,
  isImporting: false,
  progress: null as { current: number; total: number } | null,
  completedJob: null as Record<string, unknown> | null,
  resetState: vi.fn(),
  handleFileSelect: vi.fn(),
  handleDownloadTemplate: vi.fn(),
  handleStartImport: vi.fn(),
};

vi.mock("@/lib/backgroundJobs/useModuleCsvImportActions", () => ({
  useModuleCsvImportActions: (options: Record<string, unknown>) => {
    hookCalls.push(options);
    return hookState;
  },
}));

import { StandardModuleCsvImportDialog } from "./StandardModuleCsvImportDialog";

describe("StandardModuleCsvImportDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    hookCalls.length = 0;
    hookState.completedJob = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("does not close the dialog on submit success (completion panel stays visible)", () => {
    // 2026-11-04 review (S-01): passing `onSuccess: onClose` unmounted the dialog the
    // moment the job finished, so the completed/partial-failure panel never rendered.
    const onClose = vi.fn();
    act(() => {
      root.render(
        <StandardModuleCsvImportDialog
          open={true}
          onClose={onClose}
          canWrite={true}
          apiPath="/api/students/import"
          title="Import Students"
        />,
      );
    });

    expect(hookCalls).toHaveLength(1);
    expect(hookCalls[0]?.onSuccess).toBeUndefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the completed job with imported/failed counts and keeps the dialog open", () => {
    hookState.completedJob = {
      id: "job-1",
      moduleId: "students",
      kind: "import",
      status: "completed",
      label: "Importing Students",
      progress: { current: 18, total: 20 },
      createdAt: "2026-11-04T00:00:00.000Z",
    };
    const onClose = vi.fn();

    act(() => {
      root.render(
        <StandardModuleCsvImportDialog
          open={true}
          onClose={onClose}
          canWrite={true}
          apiPath="/api/students/import"
          title="Import Students"
        />,
      );
    });

    expect(document.body.textContent).toContain("Importing Students");
    expect(document.body.textContent).toContain("18");
    expect(document.body.textContent).toContain("20");
    expect(document.body.textContent).toContain("2");
    expect(onClose).not.toHaveBeenCalled();
  });
});
