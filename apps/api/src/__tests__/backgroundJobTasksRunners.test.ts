import { describe, expect, it, vi } from "vitest";

const mockRegisterRunner = vi.fn();

vi.mock("../../../../packages/be-core/dist/jobs/jobRunnerRegistry.js", () => ({
  registerBackgroundJobRunner: (...args: unknown[]) => mockRegisterRunner(...args),
}));
vi.mock("@mms/be-core/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/jobs")>()),
  registerBackgroundJobRunner: (...args: unknown[]) => mockRegisterRunner(...args),
}));
vi.mock("../services/backgroundJobWorkerService.js", () => ({
  registerBackgroundJobRunner: (...args: unknown[]) => mockRegisterRunner(...args),
}));

import { registerTasksBackgroundJobRunners } from "../services/backgroundJobTasksRunners.js";

describe("registerTasksBackgroundJobRunners", () => {
  it("registers both transfer runners the routes enqueue", () => {
    registerTasksBackgroundJobRunners();

    expect(mockRegisterRunner.mock.calls.map((call) => call[0])).toEqual([
      "tasks:export",
      "tasks:import",
    ]);
  });
});
