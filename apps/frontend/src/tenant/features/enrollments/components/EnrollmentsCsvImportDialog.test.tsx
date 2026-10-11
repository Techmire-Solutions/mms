import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EnrollmentsCsvImportDialog } from "./EnrollmentsCsvImportDialog";

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
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const mockStartServerImport = vi.fn().mockResolvedValue({
  id: "job-enrollments-1",
  label: "Imported 1 enrollment",
  status: "completed",
  progress: { current: 1, total: 1 },
});

vi.mock("@/lib/backgroundJobs/startServerModuleCsvImport", () => ({
  startServerModuleCsvImport: (...args: unknown[]) => mockStartServerImport(...args),
}));

describe("EnrollmentsCsvImportDialog", () => {
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

  it("renders nothing when closed or without write permission", () => {
    act(() => {
      root.render(<EnrollmentsCsvImportDialog open={false} onClose={vi.fn()} canWrite={true} />);
    });
    expect(document.body.textContent).toBe("");

    act(() => {
      root.render(<EnrollmentsCsvImportDialog open={true} onClose={vi.fn()} canWrite={false} />);
    });
    expect(document.body.textContent).toBe("");
  });

  it("renders enrollment import modal and triggers template download from SSOT schema", async () => {
    const { triggerFileDownload } = await import("@/lib/download");

    act(() => {
      root.render(<EnrollmentsCsvImportDialog open={true} onClose={vi.fn()} canWrite={true} />);
    });

    expect(document.body.textContent).toContain("common.import");
    expect(document.body.textContent).toContain("Download CSV Template");

    const templateBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Download CSV Template"),
    );
    expect(templateBtn).toBeDefined();

    act(() => {
      templateBtn?.click();
    });

    expect(triggerFileDownload).toHaveBeenCalledWith(expect.any(Blob), "enrollments.csv");
  });

  it("accepts a valid exported enrollment CSV and initiates background import", async () => {
    const onClose = vi.fn();

    act(() => {
      root.render(<EnrollmentsCsvImportDialog open={true} onClose={onClose} canWrite={true} />);
    });

    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    // Exact export headers from enrollmentsTransferSchema
    const csvContent =
      '"Student Name","Session Name","Class Name","Base Fee"\n"Ali ibn Husayn","Spring 2024","Quran A","15000"';
    const file = new File([csvContent], "exported_enrollments.csv", { type: "text/csv" });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
        writable: true,
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("exported_enrollments.csv");
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
        path: "/api/enrollments/import",
        body: expect.objectContaining({
          rows: [
            expect.objectContaining({
              studentName: "Ali ibn Husayn",
              sessionName: "Spring 2024",
              className: "Quran A",
            }),
          ],
        }),
      }),
    );
  });
});
