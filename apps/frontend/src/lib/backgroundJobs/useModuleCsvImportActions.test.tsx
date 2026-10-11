import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useModuleCsvImportActions } from "./useModuleCsvImportActions";

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

vi.mock("@/lib/backgroundJobs/startServerModuleCsvImport", () => ({
  startServerModuleCsvImport: vi.fn().mockResolvedValue({
    id: "job-import-1",
    label: "Imported 2 students",
    status: "completed",
    progress: { current: 2, total: 2 },
  }),
}));

describe("useModuleCsvImportActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof useModuleCsvImportActions>;

  const options = {
    apiPath: "/api/test/import",
    moduleId: "test-module",
    mappings: [
      { key: "name", header: "Name", required: true },
      { key: "age", header: "Age" },
    ],
    templateColumns: [
      { header: "Name", sample: "Ali" },
      { header: "Age", sample: "20" },
    ],
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
  });

  function HookTester() {
    hookResult = useModuleCsvImportActions(options);
    return null;
  }

  it("handles template generation and download trigger", async () => {
    const { triggerFileDownload } = await import("@/lib/download");

    act(() => {
      root.render(<HookTester />);
    });

    act(() => {
      hookResult.handleDownloadTemplate();
    });

    expect(triggerFileDownload).toHaveBeenCalledWith(
      expect.any(Blob),
      "test-module_import_template.csv",
    );
  });

  it("parses valid CSV file and tracks rows", async () => {
    act(() => {
      root.render(<HookTester />);
    });

    const file = new File(['Name,Age\n"Sara",22\n"Zayd",24'], "test.csv", { type: "text/csv" });

    await act(async () => {
      await hookResult.handleFileSelect(file);
    });

    expect(hookResult.fileName).toBe("test.csv");
    expect(hookResult.parsedRows).toHaveLength(2);
    expect(hookResult.missingHeaders).toHaveLength(0);
    expect(hookResult.rowErrors).toHaveLength(0);
  });

  it("detects missing required headers", async () => {
    act(() => {
      root.render(<HookTester />);
    });

    const file = new File(['WrongHeader,Age\n"Val",22'], "test.csv", { type: "text/csv" });

    await act(async () => {
      await hookResult.handleFileSelect(file);
    });

    expect(hookResult.missingHeaders).toContain("Name");
    expect(hookResult.parsedRows).toHaveLength(0);
  });

  it("supports passing ModuleTransferSchema directly", async () => {
    const { contactsTransferSchema } = await import("@mms/shared");
    const { triggerFileDownload } = await import("@/lib/download");

    let schemaHookResult: ReturnType<typeof useModuleCsvImportActions> =
      undefined as unknown as ReturnType<typeof useModuleCsvImportActions>;

    function SchemaHookTester() {
      schemaHookResult = useModuleCsvImportActions({
        apiPath: "/api/contacts/import",
        schema: contactsTransferSchema,
      });
      return null;
    }

    act(() => {
      root.render(<SchemaHookTester />);
    });

    act(() => {
      schemaHookResult.handleDownloadTemplate();
    });

    expect(triggerFileDownload).toHaveBeenCalledWith(expect.any(Blob), "contacts.csv");

    const contactCsv = new File(
      ['Full Name,Phone Number,Is Syed\n"Ammar Yasir",+923001234567,Yes'],
      "contacts.csv",
      { type: "text/csv" },
    );

    await act(async () => {
      await schemaHookResult.handleFileSelect(contactCsv);
    });

    expect(schemaHookResult.parsedRows).toHaveLength(1);
    expect(schemaHookResult.parsedRows[0]).toMatchObject({
      name: "Ammar Yasir",
      phone: "+923001234567",
      isSyed: true,
    });
  });
});
