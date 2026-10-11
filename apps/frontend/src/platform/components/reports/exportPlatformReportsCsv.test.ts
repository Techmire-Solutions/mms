import { describe, expect, it, vi } from "vitest";
import { exportPlatformReportsCsv } from "./exportPlatformReportsCsv";
import * as downloadModule from "@/lib/download";
import type { PlatformWorkspaceRow } from "@mms/shared";

vi.mock("@/lib/download", () => ({
  triggerFileDownload: vi.fn(),
}));

describe("exportPlatformReportsCsv", () => {
  const dummyWorkspaces: PlatformWorkspaceRow[] = [
    {
      subdomain: "darululoom",
      madrasaName: "Darul Uloom",
      enabled: true,
      requireEmailVerification: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      subdomain: "alhuda",
      madrasaName: "Al-Huda",
      enabled: false,
      requireEmailVerification: false,
      createdAt: "2026-02-01T00:00:00.000Z",
    },
  ];

  const dummyStats = {
    totalWorkspaces: 2,
    activeWorkspaces: 1,
    disabledWorkspaces: 1,
    activeRate: 50,
    verifyRequiredCount: 1,
    verifyOptionalCount: 1,
  };

  it("generates CSV and triggers file download", async () => {
    const triggerSpy = vi.spyOn(downloadModule, "triggerFileDownload");

    exportPlatformReportsCsv(dummyWorkspaces, dummyStats);

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = triggerSpy.mock.calls[0];
    expect(filename).toContain("platform-reports-");
    expect(filename).toContain(".csv");

    const text = await blob.text();
    expect(text).toContain("--- PLATFORM WORKSPACES SUMMARY REPORT ---");
    expect(text).toContain("Total Workspaces,2");
    expect(text).toContain("Active Workspaces,1");
    expect(text).toContain("Activation Rate,50%");
    expect(text).toContain('"darululoom","Darul Uloom","Active","Required"');
    expect(text).toContain('"alhuda","Al-Huda","Disabled","Optional"');
  });
});
