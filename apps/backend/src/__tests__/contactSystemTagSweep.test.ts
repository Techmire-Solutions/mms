import { describe, expect, it, vi } from "vitest";

const mockWithGlobalTenant = vi.fn();
const mockWithTenant = vi.fn();
const mockReconcile = vi.fn();
const mockTryAcquireLeaderLease = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withGlobalTenant: (...args: unknown[]) => mockWithGlobalTenant(...args),
  withTenant: (...args: unknown[]) => mockWithTenant(...args),
}));
vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcile(...args),
}));
vi.mock("../lib/leaderElection.js", () => ({
  LEADER_LOCK_CONTACT_ROLE_TAGS: 1,
  tryAcquireLeaderLease: (...args: unknown[]) => mockTryAcquireLeaderLease(...args),
}));

const { runContactSystemTagSweep, scheduleContactSystemTagSweep, clearContactSystemTagSweep } =
  await import("../worker/contactSystemTagSweep.js");

function candidateTx(tagged: Array<{ contactId: string }>, employed: Array<{ contactId: string }>) {
  let call = 0;
  return {
    selectDistinct: () => {
      const rows = call++ === 0 ? tagged : employed;
      return { from: () => ({ where: () => rows }) };
    },
  };
}

describe("contact system tag sweep", () => {
  it("reconciles the deduped faculty-tag/employment candidates only", async () => {
    mockWithGlobalTenant.mockResolvedValue([{ subdomain: "demo" }]);
    mockWithTenant.mockImplementation((_tenant: string, callback: (tx: unknown) => unknown) =>
      callback(candidateTx([{ contactId: "c-1" }], [{ contactId: "c-1" }, { contactId: "c-2" }])),
    );
    mockReconcile.mockResolvedValue(1);

    const result = await runContactSystemTagSweep();

    expect(result).toEqual({ contacts: 2, changed: 1 });
    expect(mockWithTenant).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith("demo", ["c-1", "c-2"]);
  });

  it("makes no reconcile call for a workspace with no candidates", async () => {
    mockWithGlobalTenant.mockResolvedValue([{ subdomain: "demo" }]);
    mockWithTenant.mockImplementation((_tenant: string, callback: (tx: unknown) => unknown) =>
      callback(candidateTx([], [])),
    );
    mockReconcile.mockClear();

    const result = await runContactSystemTagSweep();

    expect(result).toEqual({ contacts: 0, changed: 0 });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("clears a scheduled sweep without leaving a timer behind", () => {
    vi.useFakeTimers();
    scheduleContactSystemTagSweep(() => true, 10);
    clearContactSystemTagSweep();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
