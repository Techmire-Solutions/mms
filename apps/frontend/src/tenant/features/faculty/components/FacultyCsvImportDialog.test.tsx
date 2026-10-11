import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FacultyCsvImportDialog } from "./FacultyCsvImportDialog";

vi.mock("@/lib/download", () => ({
  triggerFileDownload: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "faculty.io.importFaculties": "Import Faculty Members",
        "faculty.io.importDesignations": "Import Designations",
        "faculty.io.importFacultiesJob": "Importing faculty members…",
        "faculty.io.importDesignationsJob": "Importing designations…",
        "faculty.io.csvHint": "Upload CSV file to import records",
      })[key] ?? key,
  }),
}));

const mockStartServerImport = vi.fn().mockResolvedValue({
  id: "job-faculty-1",
  label: "Imported 1 faculty",
  status: "completed",
  progress: { current: 1, total: 1 },
});

vi.mock("@/lib/backgroundJobs/startServerModuleCsvImport", () => ({
  startServerModuleCsvImport: (...args: unknown[]) => mockStartServerImport(...args),
}));

describe("FacultyCsvImportDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it("renders nothing when closed, no entity, or without write permission", () => {
    const cases = [
      { open: false, entity: "faculties" as const, canWrite: true },
      { open: true, entity: null, canWrite: true },
      { open: true, entity: "faculties" as const, canWrite: false },
    ];
    for (const props of cases) {
      act(() => {
        root.render(<FacultyCsvImportDialog {...props} onClose={vi.fn()} />);
      });
      expect(document.body.textContent).toBe("");
    }
  });

  it("renders faculty import modal and triggers template download from SSOT schema", async () => {
    const { triggerFileDownload } = await import("@/lib/download");

    act(() => {
      root.render(
        <FacultyCsvImportDialog open={true} entity="faculties" onClose={vi.fn()} canWrite={true} />,
      );
    });

    expect(document.body.textContent).toContain("Import Faculty Members");
    expect(document.body.textContent).toContain("Download CSV Template");

    const templateBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Download CSV Template"),
    );
    expect(templateBtn).toBeDefined();

    act(() => {
      templateBtn?.click();
    });

    expect(triggerFileDownload).toHaveBeenCalledWith(expect.any(Blob), "faculty.csv");
  });

  it("renders designations import modal with appropriate title and template download", async () => {
    const { triggerFileDownload } = await import("@/lib/download");

    act(() => {
      root.render(
        <FacultyCsvImportDialog
          open={true}
          entity="designations"
          onClose={vi.fn()}
          canWrite={true}
        />,
      );
    });

    expect(document.body.textContent).toContain("Import Designations");
    expect(document.body.textContent).toContain("Download CSV Template");

    const templateBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Download CSV Template"),
    );
    expect(templateBtn).toBeDefined();

    act(() => {
      templateBtn?.click();
    });

    expect(triggerFileDownload).toHaveBeenCalledWith(
      expect.any(Blob),
      "faculty-designations_import_template.csv",
    );
  });

  it("accepts a valid exported faculty CSV and initiates background import", async () => {
    const onClose = vi.fn();

    act(() => {
      root.render(
        <FacultyCsvImportDialog open={true} entity="faculties" onClose={onClose} canWrite={true} />,
      );
    });

    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    // Symmetrical CSV structure matching export headers exactly
    const csvContent =
      '"Faculty Name","Employee ID","Department","Designation"\n"Sayyid Murtadha","EMP-102","Fiqh","Professor"';
    const file = new File([csvContent], "exported_faculty.csv", { type: "text/csv" });

    // Simulate file input change
    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
        writable: true,
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("exported_faculty.csv");
    expect(document.body.textContent).toContain("1 valid record(s) ready to import");

    const importBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Import 1 Records"),
    );
    expect(importBtn).toBeDefined();

    await act(async () => {
      importBtn?.click();
    });

    expect(mockStartServerImport).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/faculty/import",
        body: expect.objectContaining({
          rows: [
            expect.objectContaining({
              name: "Sayyid Murtadha",
              employeeId: "EMP-102",
              department: "Fiqh",
              designation: "Professor",
            }),
          ],
        }),
      }),
    );
  });
});
