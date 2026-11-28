import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadBackgroundJobArtifact } from "./api";
import * as clientModule from "../api/client";
import * as downloadModule from "../api/download";

vi.mock("../api/download", () => ({
  triggerFileDownload: vi.fn(),
}));

describe("downloadBackgroundJobArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads file immediately on successful response", async () => {
    const mockBlob = new Blob(["name\nJohn"], { type: "text/csv" });
    const mockResponse = {
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="contacts_export.csv"',
      }),
    } as unknown as Response;

    vi.spyOn(clientModule, "apiFetch").mockResolvedValue(mockResponse);

    await downloadBackgroundJobArtifact("job-123", "fallback.csv");

    expect(clientModule.apiFetch).toHaveBeenCalledTimes(1);
    expect(downloadModule.triggerFileDownload).toHaveBeenCalledWith(
      mockBlob,
      "contacts_export.csv",
    );
  });

  it("retries on 404 and downloads file when subsequent attempt succeeds", async () => {
    const mockBlob = new Blob(["data"], { type: "text/csv" });
    const notFoundResponse = {
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue("Not yet available"),
    } as unknown as Response;

    const successResponse = {
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: new Headers(),
    } as unknown as Response;

    vi.spyOn(clientModule, "apiFetch")
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce(successResponse);

    await downloadBackgroundJobArtifact("job-123", "fallback.csv");

    expect(clientModule.apiFetch).toHaveBeenCalledTimes(2);
    expect(downloadModule.triggerFileDownload).toHaveBeenCalledWith(mockBlob, "fallback.csv");
  });

  it("throws error with message when all retries are exhausted", async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(JSON.stringify({ message: "Storage unavailable" })),
    } as unknown as Response;

    vi.spyOn(clientModule, "apiFetch").mockResolvedValue(errorResponse);

    await expect(downloadBackgroundJobArtifact("job-456", "export.csv")).rejects.toThrow(
      "Storage unavailable",
    );
  });
});
