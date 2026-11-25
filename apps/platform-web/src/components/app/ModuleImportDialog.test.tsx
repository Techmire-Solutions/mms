import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModuleImportDialog } from "@mms/fe-core/components/ModuleImportDialog";
vi.mock("@mms/fe-core/i18n", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

describe("ModuleImportDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  const baseActions = {
    fileName: "",
    parsedRows: [],
    missingHeaders: [],
    rowErrors: [],
    preflightErrors: [],
    preflightUnavailable: null,
    isPreflighting: false,
    isImporting: false,
    progress: null,
    completedJob: null,
    handleFileSelect: vi.fn(),
    handleDownloadTemplate: vi.fn(),
    handleStartImport: vi.fn(),
    resetState: vi.fn(),
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("renders nothing when closed or without write permission", () => {
    act(() => {
      root.render(
        <ModuleImportDialog
          open={false}
          onClose={vi.fn()}
          title="Import Students"
          canWrite={true}
          actions={baseActions}
        />,
      );
    });
    expect(document.body.textContent).toBe("");

    act(() => {
      root.render(
        <ModuleImportDialog
          open={true}
          onClose={vi.fn()}
          title="Import Students"
          canWrite={false}
          actions={baseActions}
        />,
      );
    });
    expect(document.body.textContent).toBe("");
  });

  it("renders dropzone and template download button when open", () => {
    act(() => {
      root.render(
        <ModuleImportDialog
          open={true}
          onClose={vi.fn()}
          title="Import Students"
          canWrite={true}
          actions={baseActions}
        />,
      );
    });

    expect(document.body.textContent).toContain("Import Students");
    expect(document.body.textContent).toContain("Download CSV Template");
    expect(document.body.textContent).toContain("Drop CSV file here");

    const templateBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Download CSV Template"),
    );
    expect(templateBtn).toBeDefined();
    act(() => {
      templateBtn?.click();
    });
    expect(baseActions.handleDownloadTemplate).toHaveBeenCalledTimes(1);
  });

  it("triggers file picker when clicking the dropzone and forwards selected file", async () => {
    act(() => {
      root.render(
        <ModuleImportDialog
          open={true}
          onClose={vi.fn()}
          title="Import Students"
          canWrite={true}
          actions={baseActions}
        />,
      );
    });

    const fileInput = document.body.querySelector(
      'input[type="file"]#module-csv-file-input',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const clickSpy = vi.spyOn(fileInput, "click");
    const dropzoneButton = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Drop CSV file here"),
    );
    expect(dropzoneButton).not.toBeNull();

    act(() => {
      dropzoneButton?.click();
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const file = new File(["id,name\n1,Ahmed"], "students.csv", { type: "text/csv" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(baseActions.handleFileSelect).toHaveBeenCalledWith(file);
    expect(fileInput.value).toBe("");
  });

  it("displays parsed rows ready to import and triggers import", () => {
    const actions = {
      ...baseActions,
      fileName: "students.csv",
      parsedRows: [{ id: "1", name: "Ahmed" }],
    };

    act(() => {
      root.render(
        <ModuleImportDialog
          open={true}
          onClose={vi.fn()}
          title="Import Students"
          canWrite={true}
          actions={actions}
        />,
      );
    });

    expect(document.body.textContent).toContain("students.csv");
    expect(document.body.textContent).toContain("1 valid record(s) ready to import");

    const importBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Import 1 Records"),
    );
    expect(importBtn).toBeDefined();
    act(() => {
      importBtn?.click();
    });
    expect(actions.handleStartImport).toHaveBeenCalledTimes(1);
  });
});
