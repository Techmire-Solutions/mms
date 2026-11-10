import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HasanatBatchAwardBody, HasanatTier } from "@mms/shared";

const TIERS: HasanatTier[] = [
  { key: "bronze", name: "Bronze", minPoints: 0 },
  { key: "silver", name: "Silver", minPoints: 100 },
  { key: "gold", name: "Gold", minPoints: 250 },
];

const state = vi.hoisted(() => ({
  earned: 0,
  liveAwards: [] as Array<{ id: string; tierKey: string }>,
  existingKeys: new Set<string>(),
  sessionStatuses: new Map<string, string>(),
  insertedAwards: [] as Array<{ studentId: string; tierKey: string }>,
  revokedIds: [] as string[],
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn(async () => ({ sequence: 1, hashCurrent: "h", hashPrevious: "g" })),
}));
vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvents: vi.fn(async () => undefined),
  emitOutboxEvent: vi.fn(async () => undefined),
}));

vi.mock("../lib/workspaceDay.js", () => ({
  workspaceTodayIso: vi.fn(async () => "2026-11-10"),
}));

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  registerBackgroundJobRunner: vi.fn(),
  enqueueBackgroundJob: vi.fn().mockResolvedValue({ id: "job-1" }),
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: vi.fn(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
}));

vi.mock("../db/repositories/hasanatModulePreferencesRepository.js", () => ({
  getHasanatModulePreferences: vi.fn(async () => ({
    dailyAwardLimitPerInstructor: 0,
    tierLadder: TIERS,
  })),
}));

vi.mock("../db/repositories/hasanatTierRepository.js", () => ({
  getStudentPoints: vi.fn(async () => ({
    studentId: "stu1",
    earned: state.earned,
    balance: state.earned,
    redeemed: 0,
  })),
  listStudentAwards: vi.fn(async () => []),
  listLiveStudentAwards: vi.fn(async () => state.liveAwards),
  insertStudentAwards: vi.fn(
    async (_tenant: string, awards: Array<{ studentId: string; tierKey: string }>) => {
      state.insertedAwards.push(...awards);
      return awards.map((award, index) => ({
        id: `award-${index}`,
        tierKey: award.tierKey,
        tierName: award.tierKey,
        earnedSnapshot: state.earned,
        awardedAt: "2026-11-10T00:00:00.000Z",
        revokedAt: null,
        revokedReason: null,
      }));
    },
  ),
  revokeStudentAwards: vi.fn(async (_tenant: string, ids: string[]) => {
    state.revokedIds.push(...ids);
    return ids.length;
  }),
  listTenantTierState: vi.fn(async () => [
    { studentId: "stu1", earned: state.earned, liveAwards: state.liveAwards },
  ]),
  findStudentsForCards: vi.fn(async () => ["stu1"]),
}));

vi.mock("../db/repositories/hasanatBatchRepository.js", () => ({
  listBatchRecipients: vi.fn(async () => [
    {
      studentId: "stu1",
      studentName: "Fatima",
      classId: "cls1",
      sessionId: "ses1",
      sectionId: null,
    },
    {
      studentId: "stu2",
      studentName: "Ali",
      classId: "cls1",
      sessionId: "ses1",
      sectionId: null,
    },
  ]),
  insertBatchDistributions: vi.fn(async (_tenant: string, cards: unknown[]) =>
    cards.map((_card, index) => `hd-batch-${index}`),
  ),
  findDistributionsByClientRequestIds: vi.fn(async (_tenant: string, keys: string[]) =>
    keys
      .filter((key) => state.existingKeys.has(key))
      .map((key) => ({ id: `existing-${key}`, clientRequestId: key, studentId: "stu1" })),
  ),
  findStudentsByNames: vi.fn(async () => []),
}));

vi.mock("../db/repositories/hasanatCardOps.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    findSessionStatuses: vi.fn(
      async (_tenant: string, ids: string[]) =>
        new Map(ids.map((id) => [id, state.sessionStatuses.get(id) ?? "open"])),
    ),
    findSessionIdForClass: vi.fn(async () => "ses1"),
  };
});

const { reconcileStudentTier, reconcileTenantTiers } =
  await import("../hasanat/use-cases/hasanatTierUseCases.js");
const { issueHasanatCardsBatch } =
  await import("../hasanat/use-cases/hasanatBatchAwardUseCases.js");
const { assertSessionWritable, assertSessionsWritable } =
  await import("../hasanat/use-cases/hasanatSessionGuard.js");
const { createHasanatCardWriteFacade } =
  await import("../hasanat/use-cases/hasanatCardWriteFacade.js");
const { HASANAT_BULK_AWARD_JOB_KIND, registerHasanatBulkAwardRunner } =
  await import("../hasanat/use-cases/hasanatBatchAwardJob.js");
const { HASANAT_IMPORT_JOB_KEY, registerHasanatImportRunner } =
  await import("../hasanat/use-cases/hasanatImportJob.js");
const { batchCardRequestId } = await import("@mms/shared");

function fakeRepo() {
  return {
    findFacultyIdForUser: vi.fn(async () => null),
    listClassIdsTaughtByFaculty: vi.fn(async () => []),
    filterStudentsInFacultyClasses: vi.fn(async () => []),
    findTenantUserRole: vi.fn(async () => "admin"),
    findDistributionsByIds: vi.fn(async () => []),
    findDenomById: vi.fn(async () => ({
      id: "den1",
      name: "Gold",
      points: 50,
      color: "amber",
      description: "",
      icon: "Star",
      active: true,
    })),
    findBatchRemaining: vi.fn(async () => 100),
    lockInstructorQuota: vi.fn(async () => undefined),
    countIssuedByUserOnDate: vi.fn(async () => 0),
  } as unknown as Parameters<typeof issueHasanatCardsBatch>[3];
}

const BATCH_BODY: HasanatBatchAwardBody = {
  batchId: "batch1",
  denominationId: "den1",
  target: { kind: "class", sessionId: "ses1", classId: "cls1" },
  reason: "Weekly halaqa attendance",
  issuedDate: "2026-11-10",
  clientRequestId: "req-abcdefgh",
};

describe("hasanat tier reconciliation", () => {
  beforeEach(() => {
    state.earned = 0;
    state.liveAwards = [];
    state.insertedAwards = [];
    state.revokedIds = [];
  });

  it("awards the tier reached by lifetime earned points", async () => {
    state.earned = 120;
    const result = await reconcileStudentTier("demo", "stu1");

    expect(result.awarded).toBe(1);
    expect(state.insertedAwards).toMatchObject([{ studentId: "stu1", tierKey: "silver" }]);
  });

  it("does not duplicate an award the student already holds", async () => {
    state.earned = 120;
    state.liveAwards = [{ id: "award-silver", tierKey: "silver" }];
    const result = await reconcileStudentTier("demo", "stu1");

    expect(result.awarded).toBe(0);
    expect(state.insertedAwards).toEqual([]);
  });

  it("revokes an award that a retroactive reduction no longer supports", async () => {
    state.earned = 90;
    state.liveAwards = [
      { id: "award-silver", tierKey: "silver" },
      { id: "award-bronze", tierKey: "bronze" },
    ];
    const result = await reconcileStudentTier("demo", "stu1");

    expect(result.revoked).toBe(1);
    expect(state.revokedIds).toEqual(["award-silver"]);
    expect(state.insertedAwards).toEqual([]);
  });

  it("backfills the whole tenant with batched writes", async () => {
    state.earned = 260;
    const result = await reconcileTenantTiers("demo");

    expect(result).toMatchObject({ students: 1, awarded: 1, revoked: 0 });
    expect(state.insertedAwards).toMatchObject([{ studentId: "stu1", tierKey: "gold" }]);
  });
});

describe("hasanat batch awarding", () => {
  beforeEach(() => {
    state.existingKeys = new Set();
    state.sessionStatuses = new Map();
    state.insertedAwards = [];
    state.earned = 0;
    state.liveAwards = [];
  });

  it("issues one card per recipient with per-recipient idempotency keys", async () => {
    const result = await issueHasanatCardsBatch("demo", BATCH_BODY, { userId: "u1" }, fakeRepo());

    expect(result.issued).toBe(2);
    expect(result.skipped).toEqual([]);
    expect(result.distributionIds).toHaveLength(2);
    const key = batchCardRequestId(BATCH_BODY.clientRequestId, "stu1");
    expect(key.startsWith("bulk-")).toBe(true);
  });

  it("replays a request without duplicating cards", async () => {
    state.existingKeys = new Set([
      batchCardRequestId(BATCH_BODY.clientRequestId, "stu1"),
      batchCardRequestId(BATCH_BODY.clientRequestId, "stu2"),
    ]);

    const result = await issueHasanatCardsBatch("demo", BATCH_BODY, { userId: "u1" }, fakeRepo());

    expect(result.issued).toBe(0);
    expect(result.skipped).toEqual([
      { studentId: "stu1", reason: "already_awarded" },
      { studentId: "stu2", reason: "already_awarded" },
    ]);
  });

  it("rejects the whole batch when stock cannot cover the group", async () => {
    const repo = fakeRepo();
    (repo.findBatchRemaining as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await expect(
      issueHasanatCardsBatch("demo", BATCH_BODY, { userId: "u1" }, repo),
    ).rejects.toThrow(/Only 1 card/i);
  });

  it("rejects the whole batch when the instructor quota cannot cover it", async () => {
    const repo = fakeRepo();
    (repo.countIssuedByUserOnDate as ReturnType<typeof vi.fn>).mockResolvedValue(4);

    await expect(
      issueHasanatCardsBatch("demo", BATCH_BODY, { userId: "u1", quotaLimit: 5 }, repo),
    ).rejects.toThrow(/daily awarding limit leaves 1 card/i);
  });

  it("rejects the batch when any recipient's session is closed", async () => {
    state.sessionStatuses = new Map([["ses1", "completed"]]);

    await expect(
      issueHasanatCardsBatch("demo", BATCH_BODY, { userId: "u1" }, fakeRepo()),
    ).rejects.toThrow(/completed session/i);
  });
});

describe("hasanatSessionGuard", () => {
  it("allows null or empty session IDs", async () => {
    await expect(assertSessionWritable("demo", null)).resolves.toBeUndefined();
    await expect(assertSessionsWritable("demo", [])).resolves.toBeUndefined();
  });

  it("throws ConflictError when session is closed", async () => {
    state.sessionStatuses = new Map([["ses-closed", "archived"]]);
    await expect(assertSessionWritable("demo", "ses-closed")).rejects.toThrow(/archived/i);
    await expect(assertSessionsWritable("demo", ["ses-closed"])).rejects.toThrow(/archived/i);
  });
});

describe("hasanatCardWriteFacade", () => {
  it("initializes facade and executes delete and restore", async () => {
    const crud = {
      deleteById: vi.fn(async () => true),
      restoreById: vi.fn(async () => true),
      bulkDeleteByIds: vi.fn(async () => ({ succeeded: 1, failed: 0 })),
      bulkRestoreByIds: vi.fn(async () => ({ succeeded: 1, failed: 0 })),
    };
    const facade = createHasanatCardWriteFacade({
      repo: fakeRepo(),
      crud,
      requireTenant: () => "demo",
      requireActorUserId: () => "u1",
      loadPreferences: async () => ({
        pointsPerUnit: 1,
        autoApprovePayouts: true,
        defaultViewLayout: "list",
        dailyAwardLimitPerInstructor: 10,
        awardScope: "tenant" as const,
        tierLadder: [],
      }),
    });
    expect(facade).toBeDefined();
    await expect(facade.deleteDistributionById("c1", "user1", "reason")).resolves.toBe(true);
    await expect(facade.restoreDistributionById("c1", "user1")).resolves.toBe(true);
    await expect(facade.bulkSoftDeleteDistributions(["c1"], "user1", "reason")).resolves.toEqual({
      succeeded: 1,
      failed: 0,
    });
    await expect(facade.bulkRestoreDistributions(["c1"], "user1")).resolves.toEqual({
      succeeded: 1,
      failed: 0,
    });
  });
});

describe("hasanat background jobs registration", () => {
  it("registers bulk award runner", () => {
    registerHasanatBulkAwardRunner();
    expect(HASANAT_BULK_AWARD_JOB_KIND).toBe("bulk-award");
  });

  it("registers import job runner", () => {
    registerHasanatImportRunner();
    expect(HASANAT_IMPORT_JOB_KEY).toBe("hasanat:import");
  });
});

describe("batch award queue payload", () => {
  it("enqueues a count-only payload so large groups never trip the 1 MB ceiling", async () => {
    const { listBatchRecipients } = await import("../db/repositories/hasanatBatchRepository.js");
    vi.mocked(listBatchRecipients).mockResolvedValueOnce(
      Array.from({ length: 201 }, (_, index) => ({
        studentId: `stu-${index}`,
        studentName: `Student ${index}`,
        classId: "cls1",
        sessionId: "ses1",
        sectionId: null,
      })),
    );
    const { enqueueBackgroundJob } = await import("../services/backgroundJobWorkerService.js");

    const facade = createHasanatCardWriteFacade({
      repo: fakeRepo(),
      crud: {
        deleteById: vi.fn(async () => true),
        restoreById: vi.fn(async () => true),
        bulkDeleteByIds: vi.fn(async () => ({ succeeded: 0, failed: 0 })),
        bulkRestoreByIds: vi.fn(async () => ({ succeeded: 0, failed: 0 })),
      },
      requireTenant: () => "demo",
      requireActorUserId: () => "u1",
      loadPreferences: async () => ({
        pointsPerUnit: 1,
        autoApprovePayouts: true,
        defaultViewLayout: "list",
        dailyAwardLimitPerInstructor: 0,
        awardScope: "tenant" as const,
        tierLadder: [],
      }),
    });

    const result = await facade.batchAward(BATCH_BODY);
    expect(result.queued).toBe(true);

    const payload = vi.mocked(enqueueBackgroundJob).mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload.recipientCount).toBe(201);
    expect(payload.recipients).toBeUndefined();
  });
});
