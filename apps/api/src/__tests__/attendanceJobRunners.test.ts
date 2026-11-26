import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureAttendanceAdapters } from "../modules/attendance/adapters.js";

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

vi.mock("../../../../packages/be-core/dist/jobs/jobRunnerRegistry.js", () => ({
  registerBackgroundJobRunner: (key: string, runner: unknown) => {
    mocks.runners.set(key, runner);
  },
  hasBackgroundJobRunner: (key: string) => mocks.runners.has(key),
}));
vi.mock("@mms/be-core/jobs", () => ({
  registerModuleCsvExportJobRunner: (options: { moduleId: string }) => {
    mocks.runners.set(`${options.moduleId}:export`, vi.fn());
  },
  registerModuleCsvImportJobRunner: (options: { moduleId: string }) => {
    mocks.runners.set(`${options.moduleId}:import`, vi.fn());
  },
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
vi.mock("@mms/mod-attendance/backend/use-cases", () => ({
  streamAcademicCalendarCsv: vi.fn(),
  streamAcademicCalendarIcs: vi.fn(),
  recordApprovedLeave: vi.fn(),
  copySessionCalendarEvents: vi.fn(),
  scanAbsenceStreaks: vi.fn(),
}));
vi.mock("../lib/registerModuleCsvExportJobRunner.js", () => ({
  registerModuleCsvExportJobRunner: (options: { moduleId: string }) => {
    mocks.runners.set(`${options.moduleId}:export`, vi.fn());
  },
}));

const { registerAttendanceJobRunners } = await import("@mms/mod-attendance/backend/jobs");
const { hasBackgroundJobRunner } = await import("@mms/be-core/jobs");

beforeEach(() => {
  configureAttendanceAdapters();
  mocks.runners.clear();
});

describe("attendance job runners", () => {
  it("registers the export, import, and absence-scan runners", () => {
    registerAttendanceJobRunners();
    expect(hasBackgroundJobRunner("attendance:export")).toBe(true);
    expect(hasBackgroundJobRunner("attendance:import")).toBe(true);
    expect(hasBackgroundJobRunner("attendance-calendar:import")).toBe(true);
    expect(hasBackgroundJobRunner("attendance:absence-scan")).toBe(true);
  });
});
