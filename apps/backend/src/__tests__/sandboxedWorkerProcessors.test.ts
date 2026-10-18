import { describe, expect, it } from "vitest";
import {
  WORKER_SUBPROCESS_MEMORY_LIMIT_MB,
  JOB_EXECUTION_TIMEOUT_MS,
  WORKER_FORK_OPTIONS,
  resolveProcessorPath,
} from "../worker/queues/queueConfig.js";
import { existsSync } from "node:fs";

describe("Sandboxed Worker Subprocess & Resource Limits", () => {
  it("configures child process memory limit to 512 MB", () => {
    expect(WORKER_SUBPROCESS_MEMORY_LIMIT_MB).toBe(512);
    expect(WORKER_FORK_OPTIONS.execArgv).toContain("--max-old-space-size=512");
  });

  it("enforces a hard 60-second job execution timeout constant", () => {
    expect(JOB_EXECUTION_TIMEOUT_MS).toBe(60_000);
  });

  it("resolves valid sandboxed processor file paths", () => {
    const pdfProcessorPath = resolveProcessorPath("sandboxedPdfProcessor");
    const exportProcessorPath = resolveProcessorPath("sandboxedExportProcessor");

    expect(typeof pdfProcessorPath).toBe("string");
    expect(typeof exportProcessorPath).toBe("string");
    expect(existsSync(pdfProcessorPath)).toBe(true);
    expect(existsSync(exportProcessorPath)).toBe(true);
  });
});
