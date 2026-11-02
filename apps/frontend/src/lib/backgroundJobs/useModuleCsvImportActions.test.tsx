import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BackgroundJobRecord } from "@mms/shared";
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

  it("submits parsed rows through a custom submitRows and forwards progress", async () => {
    const { startServerModuleCsvImport } =
      await import("@/lib/backgroundJobs/startServerModuleCsvImport");
    const { notify } = await import("@/lib/notify");

    const submitRows = vi.fn(
      async (
        rows: Record<string, unknown>[],
        onProgress: (progress: { current: number; total: number }) => void,
      ): Promise<BackgroundJobRecord> => {
        onProgress({ current: 1, total: rows.length });
        return {
          id: "job-custom-1",
          moduleId: "test-module",
          kind: "import",
          status: "completed",
          label: "Imported 2 of 2 rows",
          progress: { current: 2, total: 2 },
          createdAt: "2026-11-02T00:00:00.000Z",
        };
      },
    );

    function SubmitRowsHookTester() {
      hookResult = useModuleCsvImportActions<Record<string, unknown>>({
        ...options,
        submitRows,
      });
      return <div>{hookResult.completedJob?.label}</div>;
    }

    act(() => {
      root.render(<SubmitRowsHookTester />);
    });

    const file = new File(['Name,Age\n"Sara",22\n"Zayd",24'], "custom.csv", { type: "text/csv" });

    await act(async () => {
      await hookResult.handleFileSelect(file);
    });

    await act(async () => {
      await hookResult.handleStartImport();
    });

    expect(submitRows).toHaveBeenCalledTimes(1);
    expect(submitRows).toHaveBeenCalledWith(
      [
        { name: "Sara", age: "22" },
        { name: "Zayd", age: "24" },
      ],
      expect.any(Function),
    );
    expect(hookResult.completedJob).toMatchObject({ id: "job-custom-1" });
    expect(hookResult.progress).toEqual({ current: 1, total: 2 });
    expect(container.textContent).toContain("Imported 2 of 2 rows");
    expect(startServerModuleCsvImport).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith("Imported 2 of 2 rows");
  });

  it("posts through the module starter when submitRows is not supplied", async () => {
    const { startServerModuleCsvImport } =
      await import("@/lib/backgroundJobs/startServerModuleCsvImport");

    act(() => {
      root.render(<HookTester />);
    });

    const file = new File(['Name,Age\n"Sara",22\n"Zayd",24'], "default.csv", {
      type: "text/csv",
    });

    await act(async () => {
      await hookResult.handleFileSelect(file);
    });

    await act(async () => {
      await hookResult.handleStartImport();
    });

    expect(startServerModuleCsvImport).toHaveBeenCalledWith({
      path: "/api/test/import",
      body: {
        rows: [
          { name: "Sara", age: "22" },
          { name: "Zayd", age: "24" },
        ],
        label: "Importing test-module",
      },
      onProgress: expect.any(Function),
    });
    expect(hookResult.completedJob).toMatchObject({ id: "job-import-1" });
  });
});
