import { describe, expect, it, vi } from "vitest";

const mockRegisterRunner = vi.fn();

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
