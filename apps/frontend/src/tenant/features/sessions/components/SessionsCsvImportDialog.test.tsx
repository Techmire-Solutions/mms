import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionsCsvImportDialog } from "./SessionsCsvImportDialog";

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
  id: "job-sessions-1",
  label: "Imported 1 session",
  status: "completed",
  progress: { current: 1, total: 1 },
});

vi.mock("@/lib/backgroundJobs/startServerModuleCsvImport", () => ({
  startServerModuleCsvImport: (...args: unknown[]) => mockStartServerImport(...args),
}));

describe("SessionsCsvImportDialog", () => {
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
      root.render(<SessionsCsvImportDialog open={false} onClose={vi.fn()} canWrite={true} />);
    });
    expect(document.body.textContent).toBe("");

    act(() => {
      root.render(<SessionsCsvImportDialog open={true} onClose={vi.fn()} canWrite={false} />);
    });
    expect(document.body.textContent).toBe("");
  });

  it("renders session import modal and triggers template download from SSOT schema", async () => {
    const { triggerFileDownload } = await import("@/lib/download");

    act(() => {
      root.render(<SessionsCsvImportDialog open={true} onClose={vi.fn()} canWrite={true} />);
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

    expect(triggerFileDownload).toHaveBeenCalledWith(expect.any(Blob), "sessions.csv");
  });

  it("accepts a valid exported session CSV and initiates background import", async () => {
    const onClose = vi.fn();

    act(() => {
      root.render(<SessionsCsvImportDialog open={true} onClose={onClose} canWrite={true} />);
    });

    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    // Exact export headers from sessionsTransferSchema
    const csvContent =
      '"Session Name","Session Type","Base Fee","Capacity"\n"Summer 2024","regular","15000","50"';
    const file = new File([csvContent], "exported_sessions.csv", { type: "text/csv" });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
        writable: true,
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("exported_sessions.csv");
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
        path: "/api/sessions/import",
        body: expect.objectContaining({
          rows: [
            expect.objectContaining({
              name: "Summer 2024",
              type: "regular",
            }),
          ],
        }),
      }),
    );
  });
});
