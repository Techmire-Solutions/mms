import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const mockGetWorkspaceTimezone = vi.fn();
const mockWithTenantRead = vi.fn();
const mockLoadCountableAttendanceSql = vi.fn();

vi.mock("../lib/workspaceTimezone.js", () => ({
  getWorkspaceTimezone: (...args: unknown[]) => mockGetWorkspaceTimezone(...args),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: (...args: unknown[]) => mockWithTenantRead(...args),
}));

vi.mock("../db/repositories/attendanceCountableSql.js", () => ({
  loadCountableAttendanceSql: (...args: unknown[]) => mockLoadCountableAttendanceSql(...args),
}));

import { aggregateAttendanceCommandMetrics } from "../db/repositories/attendanceRepositoryMetrics.js";

/** Flattens a Drizzle SQL tree into readable text (SQL fragments + bound values). */
function collectSqlText(value: unknown, parts: string[] = []): string {
  if (value == null) return parts.join(" ");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    parts.push(String(value));
    return parts.join(" ");
  }
  if (value instanceof Date) {
    parts.push(value.toISOString());
    return parts.join(" ");
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSqlText(entry, parts);
    return parts.join(" ");
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.queryChunks)) {
    collectSqlText(record.queryChunks, parts);
    return parts.join(" ");
  }
  if (typeof record.value === "string" || typeof record.value === "number") {
    parts.push(String(record.value));
    return parts.join(" ");
  }
  if (typeof record.name === "string") {
    parts.push(record.name);
    return parts.join(" ");
  }
  return parts.join(" ");
}

const EMPTY_ROW = {
  total: 0,
  selectedDatePresent: 0,
  selectedDateAbsent: 0,
  selectedDateLate: 0,
  selectedDateExcused: 0,
  periodTotal: 0,
  selectedDatePresentRate: 0,
  overallPresentRate: 0,
  priorDate: null,
};

describe("aggregateAttendanceCommandMetrics (workspace day)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspaceTimezone.mockResolvedValue("Asia/Karachi");
    mockLoadCountableAttendanceSql.mockResolvedValue(() => sql`true`);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the workspace-local calendar day for selectedDate and periodStart", async () => {
    // 2026-03-10 20:30 UTC == 2026-03-11 01:30 in Asia/Karachi.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T20:30:00Z"));

    let projection: Record<string, unknown> = {};
    mockWithTenantRead.mockImplementation(
      async (_tenant: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const node = () => ({
          from: () => ({ where: () => Promise.resolve([EMPTY_ROW]) }),
        });
        const tx = {
          select: (p: Record<string, unknown>) => {
            projection = p;
            return node();
          },
        };
        return fn(tx);
      },
    );

    await aggregateAttendanceCommandMetrics("Demo", { periodDays: 7 });

    const compiled = Object.values(projection)
      .map((value) => collectSqlText(value))
      .join(" | ");
    expect(compiled).toContain("2026-03-11"); // selectedDate (Karachi day)
    expect(compiled).toContain("2026-03-04"); // periodStart (7 days earlier, Karachi)
    expect(compiled).not.toContain("2026-03-10"); // not the UTC day
  });
});
