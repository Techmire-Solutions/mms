import { describe, expect, it, vi } from "vitest";

vi.mock("../services/backgroundJobService.js", () => ({
  createDatabaseBackgroundJob: vi.fn(),
  rowToJobRecord: vi.fn(),
}));
vi.mock("../services/backgroundJobPatch.js", () => ({ patchJob: vi.fn().mockResolvedValue({}) }));
vi.mock("../lib/backgroundJobModuleAccess.js", () => ({
  getBackgroundJobModuleDenial: vi.fn().mockResolvedValue(null),
}));
vi.mock("../worker/pubsub/jobPubSub.js", () => ({ publishJobEvent: vi.fn() }));

import { buildDeterministicJobKey } from "../lib/backgroundJobIds.js";
import {
  ENROLLMENTS_IMPORT_TIMEOUT_MS,
  JOB_EXECUTION_TIMEOUT_MS,
  resolveJobExecutionTimeoutMs,
} from "../worker/queues/queueConfig.js";
import { executeJob, hasBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import { registerEnrollmentsImportJobRunner } from "../enrollments/enrollmentsImportService.js";

describe("enrollments import background job", () => {
  it("registers the runner that the import route queues", () => {
    expect(hasBackgroundJobRunner("enrollments:import")).toBe(false);
    registerEnrollmentsImportJobRunner();
    expect(hasBackgroundJobRunner("enrollments:import")).toBe(true);
  });

  it("gives enrollments imports a long-running budget instead of the 60s default", () => {
    expect(resolveJobExecutionTimeoutMs("enrollments", "import")).toBe(
      ENROLLMENTS_IMPORT_TIMEOUT_MS,
    );
    expect(ENROLLMENTS_IMPORT_TIMEOUT_MS).toBeGreaterThan(JOB_EXECUTION_TIMEOUT_MS);
  });

  it("rejects instead of silently completing when no runner is registered", async () => {
    await expect(
      executeJob("demo", "u1", "job-missing", "unknown-module", "unknown-kind", {}),
    ).rejects.toThrow(/No background job runner registered/);
  });

  it("derives a stable idempotency key from the payload", () => {
    const first = buildDeterministicJobKey({
      moduleId: "enrollments",
      kind: "import",
      payload: { rows: [{ studentId: "s1", sessionId: "ses-1" }] },
    });
    const same = buildDeterministicJobKey({
      moduleId: "enrollments",
      kind: "import",
      payload: { rows: [{ sessionId: "ses-1", studentId: "s1" }] },
    });
    const different = buildDeterministicJobKey({
      moduleId: "enrollments",
      kind: "import",
      payload: { rows: [{ studentId: "s2", sessionId: "ses-1" }] },
    });
    expect(first).toBe(same);
    expect(first).toHaveLength(40);
    expect(first).not.toBe(different);
    expect(first).toMatch(/^[a-f0-9]+$/);
  });
});
