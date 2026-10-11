import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useGenericModuleExport } from "./useGenericModuleExport";
import * as exportModule from "./startServerModuleCsvExport";
import * as jobApi from "./backgroundJobApi";
import { notify } from "@/lib/notify";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/lib/contexts/TenantContext", () => ({
  useOptionalTenant: () => ({ subdomain: "demo" }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./startServerModuleCsvExport", () => ({
  startServerModuleCsvExport: vi.fn(),
}));

vi.mock("./backgroundJobApi", () => ({
  downloadBackgroundJobArtifact: vi.fn(),
}));

describe("useGenericModuleExport", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof useGenericModuleExport>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function renderTestHook() {
    function TestComponent() {
      hookResult = useGenericModuleExport({
        path: "/api/test/export/csv",
        filename: "test.csv",
      });
      return null;
    }

    act(() => {
      root.render(<TestComponent />);
    });
  }

  it("triggers export and downloads artifact on success", async () => {
    vi.mocked(exportModule.startServerModuleCsvExport).mockResolvedValueOnce({
      id: "job-1",
      moduleId: "test",
      kind: "export_csv",
      label: "Export test",
      status: "completed",
      progress: { current: 10, total: 10 },
      hasDownload: true,
      createdAt: new Date().toISOString(),
    });

    renderTestHook();

    await act(async () => {
      await hookResult.handleExport();
    });

    expect(exportModule.startServerModuleCsvExport).toHaveBeenCalledWith({
      path: "/api/test/export/csv",
      body: expect.objectContaining({
        filename: "demo_test.csv",
      }),
    });
    expect(jobApi.downloadBackgroundJobArtifact).toHaveBeenCalledWith("job-1", "demo_test.csv");
    expect(notify.success).toHaveBeenCalled();
  });

  it("handles failure gracefully and notifies error", async () => {
    vi.mocked(exportModule.startServerModuleCsvExport).mockRejectedValueOnce(
      new Error("Network error"),
    );

    renderTestHook();

    await act(async () => {
      await hookResult.handleExport();
    });

    expect(notify.error).toHaveBeenCalledWith("common.export", {
      description: "Network error",
    });
  });
});
