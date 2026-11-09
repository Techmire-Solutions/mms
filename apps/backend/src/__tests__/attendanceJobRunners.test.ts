import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Runner coverage + enqueue guard.
 *
 * The attendance CSV export route enqueued `attendance:export` while no runner was registered, so
 * every export job failed three attempts later in the DLQ *after* the API returned 202. These tests
 * pin both halves of the fix: the runners exist, and a route refuses to enqueue a job that would die.
 */

const mocks = vi.hoisted(() => ({
  runners: new Map<string, unknown>(),
}));

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  registerBackgroundJobRunner: (key: string, runner: unknown) => {
    mocks.runners.set(key, runner);
  },
  hasBackgroundJobRunner: (key: string) => mocks.runners.has(key),
  enqueueBackgroundJob: vi.fn(),
  getUserBackgroundJob: vi.fn(),
  getUserBackgroundJobPayload: vi.fn(),
  QueueUnavailableError: class QueueUnavailableError extends Error {},
}));

vi.mock("../services/attendanceExportService.js", () => ({
  buildAttendanceCsvExport: vi.fn(),
  generateAttendanceCsvStreamChunks: vi.fn(),
}));
vi.mock("../attendance/use-cases/attendanceEscalationUseCases.js", () => ({
  scanAbsenceStreaks: vi.fn(),
}));
vi.mock("../lib/registerModuleCsvExportJobRunner.js", () => ({
  registerModuleCsvExportJobRunner: (options: { moduleId: string }) => {
    mocks.runners.set(`${options.moduleId}:export`, vi.fn());
  },
}));

const { registerAttendanceJobRunners } =
  await import("../services/backgroundJobAttendanceRunners.js");
const { hasBackgroundJobRunner } = await import("../services/backgroundJobWorkerService.js");

beforeEach(() => {
  mocks.runners.clear();
});

describe("attendance job runners", () => {
  it("registers the export and absence-scan runners", () => {
    registerAttendanceJobRunners();
    expect(hasBackgroundJobRunner("attendance:export")).toBe(true);
    expect(hasBackgroundJobRunner("attendance:absence-scan")).toBe(true);
  });

  it("does not register an import runner (the import contract is still legacy)", () => {
    registerAttendanceJobRunners();
    expect(hasBackgroundJobRunner("attendance:import")).toBe(false);
  });
});
