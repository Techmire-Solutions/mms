import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateEnrollmentImpacts } from "@/lib/query/enrollmentImpactInvalidation";

function createClient() {
  const invalidateQueries = vi.fn();
  return {
    client: { invalidateQueries } as unknown as QueryClient,
    keys: () =>
      invalidateQueries.mock.calls.map(
        (call) => (call[0] as { queryKey: readonly unknown[] }).queryKey,
      ),
  };
}

describe("invalidateEnrollmentImpacts", () => {
  it("refreshes seats, student schedules and dashboard on an enrollment write", () => {
    const { client, keys } = createClient();
    invalidateEnrollmentImpacts(client);
    const called = keys();
    expect(called).toEqual(
      expect.arrayContaining([
        ["enrollments", "list"],
        ["sessions", "list"],
        ["students", "list"],
        ["dashboard", "summary"],
      ]),
    );
  });

  it("adds finance and admissions only for endings", () => {
    const { client, keys } = createClient();
    invalidateEnrollmentImpacts(client, { finance: true, admissions: true, placements: true });
    const called = keys();
    expect(called.some((key) => key[0] === "finance")).toBe(true);
    expect(called).toEqual(expect.arrayContaining([["enrollments", "admissions"]]));
    expect(called).toEqual(expect.arrayContaining([["enrollments", "placements"]]));
  });

  it("can limit the fan-out", () => {
    const { client, keys } = createClient();
    invalidateEnrollmentImpacts(client, {
      students: false,
      sessions: false,
      dashboard: false,
    });
    const called = keys();
    expect(called.some((key) => key[0] === "students")).toBe(false);
    expect(called.some((key) => key[0] === "sessions")).toBe(false);
    expect(called.some((key) => key[0] === "dashboard")).toBe(false);
  });
});
