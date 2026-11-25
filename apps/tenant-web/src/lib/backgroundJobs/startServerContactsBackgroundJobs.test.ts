import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundJobRecord } from "@mms/contracts";
import { startContactsDuplicateScan } from "@mms/mod-contacts/frontend/tenant/lib/startServerContactsBackgroundJobs";
import { startServerBackgroundJob } from "@mms/fe-core/backgroundJobs/startServerBackgroundJob";

vi.mock("@mms/fe-core/backgroundJobs/startServerBackgroundJob", () => ({
  startServerBackgroundJob: vi.fn(),
}));

const completedJob: BackgroundJobRecord = {
  id: "demo:user-1:scan-key",
  moduleId: "contacts",
  kind: "duplicate-scan",
  status: "completed",
  label: "duplicate-scan",
  createdAt: "2026-11-02T00:00:00.000Z",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("startContactsDuplicateScan", () => {
  beforeEach(() => {
    vi.mocked(startServerBackgroundJob).mockResolvedValue(completedJob);
  });

  it("sends a fresh idempotencyKey with the scan request", async () => {
    await startContactsDuplicateScan("duplicate-scan");

    expect(startServerBackgroundJob).toHaveBeenCalledWith({
      path: "/api/contacts/duplicates/scan",
      body: {
        label: "duplicate-scan",
        idempotencyKey: expect.stringMatching(UUID_PATTERN),
      },
    });
  });

  it("generates a distinct key for each explicit trigger", async () => {
    await startContactsDuplicateScan();
    await startContactsDuplicateScan();

    const bodies = vi
      .mocked(startServerBackgroundJob)
      .mock.calls.map(([options]) => options.body as { idempotencyKey?: string });
    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.idempotencyKey).toMatch(UUID_PATTERN);
    expect(bodies[1]?.idempotencyKey).toMatch(UUID_PATTERN);
    expect(bodies[0]?.idempotencyKey).not.toBe(bodies[1]?.idempotencyKey);
  });
});
