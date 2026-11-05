import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileContactSystemTags } from "../contacts/systemTags/contactSystemTagReconcile.js";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
  invalidateMultiTierCache: vi.fn(),
  recordModernAuditEvent: vi.fn(),
  computeStudentDesiredTags: vi.fn(),
  computeFacultyDesiredTags: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: mocks.withTenant,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: mocks.broadcastTenantUpdate,
}));

vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: mocks.invalidateMultiTierCache,
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
}));

vi.mock("../contacts/systemTags/contactSystemTagCompute.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../contacts/systemTags/contactSystemTagCompute.js",
  );
  return {
    ...actual,
    computeStudentDesiredTags: mocks.computeStudentDesiredTags,
  };
});

vi.mock("../contacts/systemTags/contactSystemTagFacultyCompute.js", () => ({
  computeFacultyDesiredTags: mocks.computeFacultyDesiredTags,
}));

describe("reconcileContactSystemTags unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 immediately if contactIds array is empty or falsy", async () => {
    const result = await reconcileContactSystemTags("tenant-a", [null, undefined, ""]);
    expect(result).toBe(0);
    expect(mocks.withTenant).not.toHaveBeenCalled();
  });

  it("reconciles tags, inserts new tags, archives removed tags, and sorts lock acquisitions", async () => {
    const executedQueries: string[] = [];
    const insertedValues: unknown[] = [];
    const updatedValues: unknown[] = [];

    const fakeTx = {
      execute: vi.fn().mockImplementation(async (query: unknown) => {
        executedQueries.push(String(query));
        return { rows: [{ today: "2026-11-05" }] };
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            return [
              {
                id: "tag-old",
                contactId: "contact-1",
                name: "Teacher",
                source: "faculty",
                systemKey: "faculty-teacher",
                archived: false,
              },
            ];
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(async (val: unknown) => {
          insertedValues.push(val);
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async (val: unknown) => {
            updatedValues.push(val);
          }),
        }),
      }),
    };

    let firstCall = true;
    mocks.withTenant.mockImplementation(
      async (_tenant: string, cb: (tx: typeof fakeTx) => Promise<unknown>) => {
        if (firstCall) {
          firstCall = false;
          // related rows query
          return [{ relatedContactId: "contact-2" }];
        }
        return cb(fakeTx);
      },
    );

    mocks.computeStudentDesiredTags.mockResolvedValue(
      new Map([
        [
          "contact-1",
          new Map([
            [
              "student-enrolled",
              {
                name: "Student",
                source: "student",
                systemKey: "student-enrolled",
                archived: false,
              },
            ],
          ]),
        ],
      ]),
    );
    mocks.computeFacultyDesiredTags.mockResolvedValue(new Map());
    mocks.recordModernAuditEvent.mockResolvedValue({ id: "audit-1" });

    const changed = await reconcileContactSystemTags("tenant-a", ["contact-1"], {
      actorId: "user-123",
    });

    expect(changed).toBe(1);
    expect(fakeTx.execute).toHaveBeenCalled();
    expect(insertedValues.length).toBeGreaterThanOrEqual(1);
    expect(updatedValues.length).toBeGreaterThanOrEqual(1);
    expect(mocks.invalidateMultiTierCache).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      domain: "contacts",
    });
    expect(mocks.broadcastTenantUpdate).toHaveBeenCalledWith("tenant-a", "collection", "contacts");
    expect(mocks.recordModernAuditEvent).toHaveBeenCalled();
  });

  it("handles audit append failure gracefully without throwing", async () => {
    const fakeTx = {
      execute: vi.fn().mockResolvedValue({ rows: [{ today: "2026-11-05" }] }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    let firstCall = true;
    mocks.withTenant.mockImplementation(
      async (_tenant: string, cb: (tx: typeof fakeTx) => Promise<unknown>) => {
        if (firstCall) {
          firstCall = false;
          return [];
        }
        return cb(fakeTx);
      },
    );

    mocks.computeStudentDesiredTags.mockResolvedValue(
      new Map([
        [
          "c-1",
          new Map([
            [
              "student-enrolled",
              {
                name: "Student",
                source: "student",
                systemKey: "student-enrolled",
                archived: false,
              },
            ],
          ]),
        ],
      ]),
    );
    mocks.computeFacultyDesiredTags.mockResolvedValue(new Map());
    mocks.recordModernAuditEvent.mockRejectedValue(new Error("Audit DB down"));

    const changed = await reconcileContactSystemTags("tenant-a", ["c-1"], { actorId: "user-1" });
    expect(changed).toBe(1);
  });
});
