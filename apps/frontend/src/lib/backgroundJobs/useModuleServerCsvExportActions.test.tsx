import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { BackgroundJobRecord } from "@mms/shared";
import {
  useModuleServerCsvExportActions,
  type UseModuleServerCsvExportActionsOptions,
} from "@/lib/backgroundJobs/useModuleServerCsvExportActions";
import { BackgroundJobTimeoutError } from "@/lib/backgroundJobs/pollBackgroundJob";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));
vi.mock("@/lib/safeAudit", () => ({ safeAudit: vi.fn() }));
vi.mock("@/lib/backgroundJobs/backgroundJobApi", () => ({
  downloadBackgroundJobArtifact: vi.fn().mockResolvedValue(undefined),
}));

const { notify } = await import("@/lib/notify");
const { safeAudit } = await import("@/lib/safeAudit");
const { downloadBackgroundJobArtifact } = await import("@/lib/backgroundJobs/backgroundJobApi");

type StartExportArgs = {
  query: Record<string, unknown>;
  columns: Array<{ id: string; label: string }>;
  filename: string;
  label: string;
  ids?: Array<string | number>;
  idempotencyKey?: string;
};

function completedJob(overrides: Partial<BackgroundJobRecord> = {}): BackgroundJobRecord {
  return {
    id: "job-1",
    moduleId: "contacts",
    kind: "export",
    status: "completed",
    label: "Exporting contacts…",
    hasDownload: true,
    progress: { current: 7, total: 7 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

type Options = UseModuleServerCsvExportActionsOptions;

describe("useModuleServerCsvExportActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let startExport: Mock<Options["startExport"]>;
  let onError: Mock<Options["onError"]>;
  let logExportAudit: { mutateAsync: Mock<Options["logExportAudit"]["mutateAsync"]> };
  let actions: {
    handleExportCSV: () => Promise<void>;
    handleBulkExport: () => Promise<void>;
    isExporting: boolean;
  };

  function renderHook(overrides: Partial<Options> = {}): void {
    const options: Options = {
      canExport: true,
      trashMode: false,
      selectedIds: [],
      columns: [{ id: "name", label: "Name" }],
      filename: "contacts.csv",
      label: "Exporting contacts…",
      successMessage: "Export downloaded",
      auditScope: "contacts.export_audit",
      filteredErrorScope: "contacts.server_export_csv",
      selectionErrorScope: "contacts.server_export_csv_selection",
      hasActiveFilters: false,
      buildFilteredQuery: () => ({ search: "ali" }),
      startExport,
      logExportAudit,
      onError,
      ...overrides,
    };

    function TestComponent() {
      actions = useModuleServerCsvExportActions(options);
      return null;
    }

    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    startExport = vi.fn<Options["startExport"]>().mockResolvedValue(completedJob());
    onError = vi.fn<Options["onError"]>();
    logExportAudit = {
      mutateAsync: vi
        .fn<Options["logExportAudit"]["mutateAsync"]>()
        .mockResolvedValue({ ok: true }),
    };
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("downloads the artifact and audits the real row count for a filtered export", async () => {
    renderHook({ hasActiveFilters: true });

    await act(async () => {
      await actions.handleExportCSV();
    });

    expect(startExport).toHaveBeenCalledTimes(1);
    expect(startExport.mock.calls[0]?.[0]).toMatchObject({
      query: { search: "ali" },
      filename: "contacts.csv",
      label: "Exporting contacts…",
    });
    expect(downloadBackgroundJobArtifact).toHaveBeenCalledWith("job-1", "contacts.csv");
    expect(notify.success).toHaveBeenCalledWith("Export downloaded");
    expect(logExportAudit.mutateAsync).toHaveBeenCalledWith({ count: 7, scope: "filtered" });
    expect(safeAudit).toHaveBeenCalledWith(expect.anything(), "contacts.export_audit");
    expect(notify.info).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("audits an unfiltered whole-directory export with scope all", async () => {
    renderHook({ hasActiveFilters: false });

    await act(async () => {
      await actions.handleExportCSV();
    });

    expect(logExportAudit.mutateAsync).toHaveBeenCalledWith({ count: 7, scope: "all" });
  });

  it("exports the selection with scope selection and the selected ids", async () => {
    renderHook({ selectedIds: ["c1", "c2"] });
    startExport.mockResolvedValue(completedJob({ progress: undefined }));

    await act(async () => {
      await actions.handleBulkExport();
    });

    expect(startExport.mock.calls[0]?.[0]).toMatchObject({ ids: ["c1", "c2"], query: {} });
    expect(logExportAudit.mutateAsync).toHaveBeenCalledWith({ count: 2, scope: "selection" });
  });

  it("does not export when the trash view, missing permission, or empty selection blocks it", async () => {
    renderHook({ trashMode: true });
    await act(async () => {
      await actions.handleExportCSV();
      await actions.handleBulkExport();
    });
    expect(startExport).not.toHaveBeenCalled();

    renderHook({ canExport: false });
    await act(async () => {
      await actions.handleExportCSV();
    });
    expect(startExport).not.toHaveBeenCalled();

    renderHook({ selectedIds: [] });
    await act(async () => {
      await actions.handleBulkExport();
    });
    expect(startExport).not.toHaveBeenCalled();
  });

  it("reports a poll timeout as in-progress instead of a failed export", async () => {
    renderHook({ hasActiveFilters: true });
    startExport.mockRejectedValue(new BackgroundJobTimeoutError());

    await act(async () => {
      await actions.handleExportCSV();
    });

    expect(notify.info).toHaveBeenCalledWith("Exporting contacts…");
    expect(onError).not.toHaveBeenCalled();
    expect(logExportAudit.mutateAsync).not.toHaveBeenCalled();
    expect(downloadBackgroundJobArtifact).not.toHaveBeenCalled();
    expect(actions.isExporting).toBe(false);
  });

  it("reuses the idempotency key after a timeout but rotates it after a job failure", async () => {
    renderHook({ hasActiveFilters: true });

    startExport.mockRejectedValueOnce(new BackgroundJobTimeoutError());
    await act(async () => {
      await actions.handleExportCSV();
    });
    const timedOutKey = (startExport.mock.calls[0]?.[0] as StartExportArgs).idempotencyKey;

    startExport.mockResolvedValueOnce(completedJob());
    await act(async () => {
      await actions.handleExportCSV();
    });
    const retryKey = (startExport.mock.calls[1]?.[0] as StartExportArgs).idempotencyKey;
    expect(retryKey).toBe(timedOutKey);

    startExport.mockRejectedValueOnce(new Error("worker exploded"));
    await act(async () => {
      await actions.handleExportCSV();
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "contacts.server_export_csv");

    startExport.mockResolvedValueOnce(completedJob());
    await act(async () => {
      await actions.handleExportCSV();
    });
    const afterFailureKey = (startExport.mock.calls[3]?.[0] as StartExportArgs).idempotencyKey;
    expect(afterFailureKey).not.toBe(retryKey);
  });

  it("blocks re-entry while an export is in flight", async () => {
    let release: (job: BackgroundJobRecord) => void = () => {};
    startExport.mockImplementation(
      () =>
        new Promise<BackgroundJobRecord>((resolve) => {
          release = resolve;
        }),
    );
    renderHook({ hasActiveFilters: true });

    let inFlight: Promise<void> = Promise.resolve();
    await act(async () => {
      inFlight = actions.handleExportCSV();
    });
    expect(actions.isExporting).toBe(true);

    await act(async () => {
      await actions.handleExportCSV();
    });
    expect(startExport).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(completedJob());
      await inFlight;
    });
    expect(actions.isExporting).toBe(false);
  });

  it("prepends tenantName to the export filename", async () => {
    renderHook({ tenantName: "Al Huda Academy", hasActiveFilters: true });

    await act(async () => {
      await actions.handleExportCSV();
    });

    expect(startExport).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "Al_Huda_Academy_contacts.csv",
      }),
    );
    expect(downloadBackgroundJobArtifact).toHaveBeenCalledWith(
      "job-1",
      "Al_Huda_Academy_contacts.csv",
    );
  });
});
