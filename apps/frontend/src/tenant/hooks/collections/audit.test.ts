import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUDIT_EVENTS_QUERY_KEY, auditEventsQueryOptions } from "./audit";

const apiContractMock = vi.hoisted(() => ({
  audit: { listEvents: vi.fn().mockResolvedValue({ status: 200, body: {} }) },
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));

describe("auditEventsQueryOptions", () => {
  beforeEach(() => {
    apiContractMock.audit.listEvents.mockClear();
  });

  it("targets the unfiltered events endpoint with the shared query key", async () => {
    const options = auditEventsQueryOptions();
    expect(options.queryKey).toEqual([...AUDIT_EVENTS_QUERY_KEY, {}]);
    expect(options.staleTime).toBe(30_000);

    const signal = new AbortController().signal;
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(apiContractMock.audit.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ query: {}, signal }),
    );
  });

  it("serializes active filters into the request query", async () => {
    const options = auditEventsQueryOptions({ limit: 10, offset: 20, tableName: "students" });

    const signal = new AbortController().signal;
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(apiContractMock.audit.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ query: { limit: 10, offset: 20, tableName: "students" } }),
    );
  });
});
