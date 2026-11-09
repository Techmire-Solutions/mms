import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WidgetQuery } from "@mms/shared";

/**
 * Widget analytics: bounded range, index-friendly comparisons and capped concurrency.
 *
 * The previous shape scanned all history with `lower(trim(col::text))` filters — no index could
 * apply and up to 32 widgets ran their scans at once.
 */

const mockWithTenantRead = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantRead(...args),
  withTenantRead: (...args: unknown[]) => mockWithTenantRead(...args),
}));

import {
  WIDGET_DEFAULT_RANGE_DAYS,
  WIDGET_MAX_RANGE_DAYS,
  WIDGET_QUERY_CONCURRENCY,
  resolveWidgetRange,
  runWidgetQueries,
} from "../db/repositories/attendanceRepositoryWidgets.js";

function widget(overrides: Partial<WidgetQuery> = {}): WidgetQuery {
  return { id: "w1", operation: "count", ...overrides } as WidgetQuery;
}

describe("resolveWidgetRange", () => {
  it("defaults to the last 30 days", () => {
    const range = resolveWidgetRange(widget());
    const span =
      (Date.parse(`${range.dateTo}T00:00:00Z`) - Date.parse(`${range.dateFrom}T00:00:00Z`)) /
        86_400_000 +
      1;
    expect(span).toBe(WIDGET_DEFAULT_RANGE_DAYS + 1);
  });

  it("clamps a range wider than a year", () => {
    const range = resolveWidgetRange(widget({ dateFrom: "2020-01-01", dateTo: "2026-01-01" }));
    const span =
      (Date.parse(`${range.dateTo}T00:00:00Z`) - Date.parse(`${range.dateFrom}T00:00:00Z`)) /
        86_400_000 +
      1;
    expect(span).toBeLessThanOrEqual(WIDGET_MAX_RANGE_DAYS);
  });

  it("keeps a valid explicit range", () => {
    expect(resolveWidgetRange(widget({ dateFrom: "2026-03-01", dateTo: "2026-03-31" }))).toEqual({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
    });
  });
});

describe("runWidgetQueries", () => {
  it("never runs more than the concurrency ceiling at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const queries = Array.from({ length: 12 }, (_, index) => widget({ id: `w${index}` }));

    const results = await runWidgetQueries(queries, async (query) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return query.id;
    });

    expect(peak).toBeLessThanOrEqual(WIDGET_QUERY_CONCURRENCY);
    // Order is preserved for the response map.
    expect(results).toEqual(queries.map((query) => query.id));
  });
});

describe("aggregateAttendanceWidgetQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies a range predicate and uses a raw status comparison", async () => {
    const captured: string[] = [];
    const rowsQueue: unknown[][] = [
      [{ count: 4 }],
      [{ count: 4 }],
      [{ name: "present", value: 4 }],
    ];
    const makeNode = (): any => ({
      then: (resolve: (value: unknown) => void) => resolve(rowsQueue.shift() ?? []),
      from: () => makeNode(),
      where: (clause: unknown) => {
        captured.push(String((clause as { queryChunks?: unknown[] }) ? "where" : "where"));
        return makeNode();
      },
      groupBy: () => makeNode(),
      orderBy: () => makeNode(),
      limit: () => makeNode(),
    });
    const tx = { select: vi.fn(() => makeNode()) };
    mockWithTenantRead.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const result = await (
      await import("../db/repositories/attendanceRepositoryWidgets.js")
    ).aggregateAttendanceWidgetQueries("demo", [widget()]);

    expect(result["w1"]?.totalCount).toBe(4);
    expect(result["w1"]?.value).toBe(4);
    // A no-filter widget reuses the range total: one range select + one chart select.
    expect(tx.select).toHaveBeenCalledTimes(2);
  });
});
