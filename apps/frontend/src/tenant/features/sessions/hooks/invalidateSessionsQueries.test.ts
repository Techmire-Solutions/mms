import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  SESSION_ACTIVITY_QUERY_KEY,
  SESSION_COMPLETION_QUERY_KEY,
  SESSION_DETAIL_QUERY_KEY,
  SESSION_ROLLOVER_RUNS_QUERY_KEY,
} from "@/lib/query/sessionQueryKeys";
import { invalidateSessionsQueries } from "./invalidateSessionsQueries";
import { invalidateSessionDependents } from "./invalidateSessionDependents";

function fakeClient(): { client: QueryClient; keys: () => unknown[][] } {
  const calls: unknown[][] = [];
  const client = {
    invalidateQueries: vi.fn((options: { queryKey: unknown[] }) => {
      calls.push(options.queryKey);
      return Promise.resolve();
    }),
  } as unknown as QueryClient;
  return { client, keys: () => calls };
}

describe("Sessions query invalidation", () => {
  it("invalidates every Sessions cache family", () => {
    const { client, keys } = fakeClient();
    invalidateSessionsQueries(client);
    const keyList = keys();
    expect(keyList).toEqual(
      expect.arrayContaining([
        ["sessions", "list"],
        SESSION_DETAIL_QUERY_KEY,
        SESSION_ACTIVITY_QUERY_KEY,
        SESSION_COMPLETION_QUERY_KEY,
        SESSION_ROLLOVER_RUNS_QUERY_KEY,
        ["sessions", "report-aggregates"],
        ["sessions", "metrics"],
        ["sessions", "widget-aggregates"],
      ]),
    );
  });

  it("invalidates enrollments by default and calendar when requested", () => {
    const { client, keys } = fakeClient();
    invalidateSessionDependents(client, { calendar: true });
    const keyList = keys();
    expect(keyList).toEqual(
      expect.arrayContaining([
        ["enrollments", "list"],
        ["attendance", "academic-calendar"],
      ]),
    );
  });
});
