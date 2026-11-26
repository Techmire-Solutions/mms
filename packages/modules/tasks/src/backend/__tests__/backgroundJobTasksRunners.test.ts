import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
}));

vi.mock("@mms/be-core/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/jobs")>()),
  registerBackgroundJobRunner: (...args: unknown[]) => mocks.register(...args),
  registerModuleCsvImportJobRunner: (opts: any) => mocks.register(`${opts.moduleId}:import`),
}));
vi.mock("../deps.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../deps.js")>()),
  registerModuleCsvExportJobRunner: (opts: any) => mocks.register(`${opts.moduleId}:export`),
}));

import { registerTasksBackgroundJobRunners } from "../jobs/backgroundJobTasksRunners.js";

describe("registerTasksBackgroundJobRunners", () => {
  it("registers both transfer runners the routes enqueue", () => {
    registerTasksBackgroundJobRunners();

    expect(mocks.register.mock.calls.map((call) => call[0])).toEqual([
      "tasks:export",
      "tasks:import",
    ]);
  });
});
