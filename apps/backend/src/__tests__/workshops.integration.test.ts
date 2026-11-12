import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { ConflictError, NotFoundError } from "../lib/httpErrors.js";
import { QueueUnavailableError } from "../services/backgroundJobEnqueue.js";
import {
  accountantToken,
  adminToken,
  assistantTeacherToken,
  teacherToken,
} from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
          : null,
      ),
  };
});

const mockListWorkshops = vi.fn();
const mockCreateWorkshop = vi.fn();
const mockSaveAttendanceDay = vi.fn();
const mockUpdateWorkshop = vi.fn();
const mockDeleteWorkshop = vi.fn();
const mockDeleteWorkshops = vi.fn();
const mockSaveScores = vi.fn();
const mockTransitionWorkshop = vi.fn();
const mockAddParticipants = vi.fn();
const mockRemoveParticipant = vi.fn();
const mockGetWorkshop = vi.fn();
const mockRestoreWorkshop = vi.fn();
const mockEnsureWorkshop = vi.fn();
const mockEnqueueJob = vi.fn();
const mockGetUserJob = vi.fn();

vi.mock("../services/backgroundJobEnqueue.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobEnqueue.js")>();
  return {
    ...actual,
    enqueueBackgroundJob: (...args: unknown[]) => mockEnqueueJob(...args),
  };
});

vi.mock("../services/backgroundJobService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobService.js")>();
  return {
    ...actual,
    getUserBackgroundJob: (...args: unknown[]) => mockGetUserJob(...args),
  };
});

vi.mock("../workshops/use-cases/workshopsUseCases.js", () => ({
  workshopsUseCases: {
    listWorkshops: (...args: unknown[]) => mockListWorkshops(...args),
    ensureWorkshop: (...args: unknown[]) => mockEnsureWorkshop(...args),
    createWorkshop: (...args: unknown[]) => mockCreateWorkshop(...args),
    saveAttendanceDay: (...args: unknown[]) => mockSaveAttendanceDay(...args),
    getWorkshop: (...args: unknown[]) => mockGetWorkshop(...args),
    updateWorkshop: (...args: unknown[]) => mockUpdateWorkshop(...args),
    deleteWorkshop: (...args: unknown[]) => mockDeleteWorkshop(...args),
    deleteWorkshops: (...args: unknown[]) => mockDeleteWorkshops(...args),
    restoreWorkshop: (...args: unknown[]) => mockRestoreWorkshop(...args),
    transitionWorkshop: (...args: unknown[]) => mockTransitionWorkshop(...args),
    addParticipant: vi.fn(),
    addParticipants: (...args: unknown[]) => mockAddParticipants(...args),
    removeParticipant: (...args: unknown[]) => mockRemoveParticipant(...args),
    saveScores: (...args: unknown[]) => mockSaveScores(...args),
    loadMetrics: vi.fn().mockResolvedValue({
      total: 0,
      upcoming: 0,
      ongoing: 0,
      finished: 0,
      participants: 0,
    }),
  },
}));

const mockSavePreferences = vi.fn();
const mockIssueCertificates = vi.fn();
const mockEvaluateCompletion = vi.fn();

vi.mock("../workshops/use-cases/workshopsCompletionUseCases.js", () => ({
  workshopsCompletionUseCases: {
    getCompletion: vi.fn().mockResolvedValue([]),
    evaluateCompletion: (...args: unknown[]) => mockEvaluateCompletion(...args),
    issueCertificates: (...args: unknown[]) => mockIssueCertificates(...args),
    getReport: vi.fn().mockResolvedValue([]),
    getPreferences: vi
      .fn()
      .mockResolvedValue({ defaultMinAttendancePct: null, defaultMinScorePct: null }),
    savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
  },
}));

type App = Awaited<ReturnType<typeof buildApp>>;
const headers = (token: string) => ({ host: "demo.localhost", authorization: `Bearer ${token}` });
const workshop = { title: "Calligraphy", startDate: "2099-03-01", endDate: "2099-03-02" };

const workshopRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "w1",
  title: "Calligraphy",
  description: "",
  startDate: "2099-03-01",
  endDate: "2099-03-02",
  registrationDeadline: null,
  capacity: null,
  fee: null,
  programId: null,
  subjectId: null,
  minAttendancePct: null,
  minScorePct: null,
  participantCount: 0,
  waitlistEnabled: false,
  status: "open",
  phase: "registration_open",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const participantSummary = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  workshopId: "w1",
  contactId: `c-${id}`,
  contactName: `Contact ${id}`,
  status: "registered",
  completedAt: null,
  certificateIssuedAt: null,
  waitlistedAt: null,
  ...overrides,
});

const detail = () => ({
  workshop: workshopRecord(),
  participants: [
    {
      id: "p1",
      workshopId: "w1",
      contactId: "c1",
      contactName: "Contact C1",
      contactPhone: "+920000000001",
      status: "registered",
      completedAt: null,
      certificateIssuedAt: null,
      waitlistedAt: null,
      createdAt: "2026-03-01T10:00:00.000Z",
    },
  ],
  waitlisted: [],
  waitlistCount: 0,
  attendance: [],
  scores: [],
});

describe("workshops REST access and validation", () => {
  let app: App;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    mockListWorkshops
      .mockReset()
      .mockResolvedValue({ workshops: [], total: 0, page: 1, limit: 15, hasMore: false });
    mockCreateWorkshop.mockReset();
    mockSaveAttendanceDay.mockReset().mockResolvedValue([]);
    mockTransitionWorkshop.mockReset().mockResolvedValue(workshopRecord());
    mockAddParticipants.mockReset().mockResolvedValue({ added: [], waitlisted: [] });
    mockRemoveParticipant.mockReset().mockResolvedValue(null);
    mockGetWorkshop.mockReset().mockResolvedValue(detail());
    mockRestoreWorkshop.mockReset().mockResolvedValue(undefined);
    mockEnsureWorkshop.mockReset().mockResolvedValue(workshopRecord());
    mockUpdateWorkshop.mockReset().mockResolvedValue(workshopRecord());
    mockDeleteWorkshop.mockReset().mockResolvedValue(undefined);
    mockDeleteWorkshops.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockSaveScores.mockReset().mockResolvedValue([]);
    mockEvaluateCompletion.mockReset().mockResolvedValue([]);
    mockEnqueueJob.mockReset().mockImplementation(async (_tenant, _userId, job) => job);
    mockGetUserJob.mockReset().mockResolvedValue(null);
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("given a teacher, should list workshops", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workshops",
      headers: headers(teacherToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(mockListWorkshops).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
  });

  it("given an accountant without a workshops grant, should forbid reading", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workshops",
      headers: headers(accountantToken(app)),
    });
    expect(res.statusCode).toBe(403);
    expect(mockListWorkshops).not.toHaveBeenCalled();
  });

  it("given an assistant teacher (read only), should forbid creating and checking in", async () => {
    const token = assistantTeacherToken(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/workshops",
      headers: headers(token),
      payload: workshop,
    });
    const checkIn = await app.inject({
      method: "PUT",
      url: "/api/workshops/w1/attendance",
      headers: headers(token),
      payload: { dayOn: "2099-03-01", marks: [{ participantId: "p1", status: "present" }] },
    });
    expect(create.statusCode).toBe(403);
    expect(checkIn.statusCode).toBe(403);
    expect(mockCreateWorkshop).not.toHaveBeenCalled();
    expect(mockSaveAttendanceDay).not.toHaveBeenCalled();
  });

  it("given a teacher listing trash, should require delete access", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workshops?includeDeleted=true",
      headers: headers(teacherToken(app)),
    });
    expect(res.statusCode).toBe(403);
  });

  it("given an end date before the start, should reject the body with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops",
      headers: headers(adminToken(app)),
      payload: { ...workshop, endDate: "2099-02-01" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockCreateWorkshop).not.toHaveBeenCalled();
  });

  it("given a domain conflict, should keep its 409 status", async () => {
    mockCreateWorkshop.mockRejectedValueOnce(
      new ConflictError("A workshop with this id already exists"),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops",
      headers: headers(adminToken(app)),
      payload: workshop,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "conflict" });
  });

  it("given a read-only role, should forbid a lifecycle action", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: {
        ...headers(assistantTeacherToken(app)),
        "x-expected-updated-at": "2026-03-01T10:00:00.000Z",
      },
      payload: { to: "open" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockTransitionWorkshop).not.toHaveBeenCalled();
  });

  it("given an admin, should forward the OCC token and return the transitioned workshop", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-updated-at": "2026-03-01T10:00:00.000Z" },
      payload: { to: "cancelled", reason: "Venue flooded" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockTransitionWorkshop).toHaveBeenCalledWith(
      "w1",
      { to: "cancelled", reason: "Venue flooded" },
      expect.objectContaining({ id: expect.any(String) }),
      "2026-03-01T10:00:00.000Z",
    );
    expect(res.json()).toMatchObject({ workshop: { status: "open" } });
  });

  it("given a version-only OCC token, should reject it as unsupported", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-version": "1" },
      payload: { to: "open" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "validation_error" });
    expect(mockTransitionWorkshop).not.toHaveBeenCalled();
  });

  it("given a malformed OCC header, should reject the request before the use case", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-updated-at": "yesterday" },
      payload: { to: "open" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockTransitionWorkshop).not.toHaveBeenCalled();
  });

  it("given an illegal target or a missing cancel reason, should reject the body with 400", async () => {
    const illegal = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-updated-at": "2026-03-01T10:00:00.000Z" },
      payload: { to: "archived" },
    });
    const noReason = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-updated-at": "2026-03-01T10:00:00.000Z" },
      payload: { to: "cancelled" },
    });
    expect(illegal.statusCode).toBe(400);
    expect(noReason.statusCode).toBe(400);
    expect(mockTransitionWorkshop).not.toHaveBeenCalled();
  });

  it("given a batch of contacts, should register them atomically through one call", async () => {
    mockAddParticipants.mockResolvedValueOnce({
      added: [{ ...participantSummary("p1"), contactPhone: "+920000000001" }],
      waitlisted: [{ ...participantSummary("p2"), contactPhone: "+920000000002" }],
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/bulk",
      headers: headers(adminToken(app)),
      payload: { contactIds: ["c1", "c2"] },
    });
    expect(res.statusCode).toBe(201);
    expect(mockAddParticipants).toHaveBeenCalledWith("w1", ["c1", "c2"]);
    expect(res.json()).toMatchObject({ added: [{ id: "p1" }], waitlisted: [{ id: "p2" }] });
    // Mutation responses are summaries: the roster keeps phones, these do not.
    expect(res.json().added[0]).not.toHaveProperty("contactPhone");
  });

  it("given a read-only role, should forbid batch registration and reject an empty batch", async () => {
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/bulk",
      headers: headers(assistantTeacherToken(app)),
      payload: { contactIds: ["c1"] },
    });
    const empty = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/bulk",
      headers: headers(adminToken(app)),
      payload: { contactIds: [] },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(empty.statusCode).toBe(400);
    expect(mockAddParticipants).not.toHaveBeenCalled();
  });

  it("given a large contact list, should queue one import job", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/import",
      headers: headers(adminToken(app)),
      payload: { contactIds: ["c1", "c2", "c3"] },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnsureWorkshop).toHaveBeenCalledWith("w1");
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    const [tenant, _userId, job, payload] = mockEnqueueJob.mock.calls[0]!;
    expect(tenant).toBe("demo");
    expect(_userId).toEqual(expect.any(String));
    expect(job).toMatchObject({ moduleId: "workshops", kind: "import" });
    expect(job.id).toContain("demo:");
    expect(payload).toEqual({ workshopId: "w1", contactIds: ["c1", "c2", "c3"] });
    expect(res.json()).toMatchObject({ job: { moduleId: "workshops", kind: "import" } });
  });

  it("given the same import body twice, should return the existing job without re-enqueuing", async () => {
    const existing = {
      id: "demo:user:key",
      moduleId: "workshops",
      kind: "import",
      status: "pending",
      label: "Importing workshop participants…",
      createdAt: new Date().toISOString(),
    };
    mockGetUserJob.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    const send = () =>
      app.inject({
        method: "POST",
        url: "/api/workshops/w1/participants/import",
        headers: headers(adminToken(app)),
        payload: { contactIds: ["c1", "c2"] },
      });
    const first = await send();
    const second = await send();
    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    expect(second.json()).toMatchObject({ job: { id: existing.id } });
  });

  it("given an oversized, duplicated or read-only import, should reject it", async () => {
    const tooMany = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/import",
      headers: headers(adminToken(app)),
      payload: { contactIds: Array.from({ length: 5001 }, (_, i) => `c-${i}`) },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/import",
      headers: headers(adminToken(app)),
      payload: { contactIds: ["c1", "c1"] },
    });
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/import",
      headers: headers(assistantTeacherToken(app)),
      payload: { contactIds: ["c1"] },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(duplicate.statusCode).toBe(400);
    expect(forbidden.statusCode).toBe(403);
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("given an unknown workshop or an unavailable queue, should map the failure", async () => {
    mockEnsureWorkshop.mockRejectedValueOnce(new NotFoundError("Workshop not found"));
    const missing = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/import",
      headers: headers(adminToken(app)),
      payload: { contactIds: ["c1"] },
    });
    mockEnqueueJob.mockRejectedValueOnce(new QueueUnavailableError());
    const unavailable = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/participants/import",
      headers: headers(adminToken(app)),
      payload: { contactIds: ["c1"] },
    });
    expect(missing.statusCode).toBe(404);
    expect(unavailable.statusCode).toBe(503);
  });

  it("given a withdrawn seat, should return the promoted waitlisted participant", async () => {
    mockRemoveParticipant.mockResolvedValueOnce({
      id: "p2",
      workshopId: "w1",
      contactId: "c2",
      contactName: "Promoted",
      contactPhone: "",
      status: "registered",
      completedAt: null,
      certificateIssuedAt: null,
      waitlistedAt: null,
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/workshops/w1/participants/p1",
      headers: headers(adminToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(mockRemoveParticipant).toHaveBeenCalledWith("w1", "p1", expect.any(String));
    expect(res.json()).toMatchObject({ success: true, promoted: { id: "p2" } });
  });

  it("given unknown query keys or an unsupported sort field, should reject the list", async () => {
    const bogus = await app.inject({
      method: "GET",
      url: "/api/workshops?bogus=1",
      headers: headers(teacherToken(app)),
    });
    const badSort = await app.inject({
      method: "GET",
      url: "/api/workshops?sortField=title;drop",
      headers: headers(teacherToken(app)),
    });
    const goodSort = await app.inject({
      method: "GET",
      url: "/api/workshops?sortField=title&sortDir=asc",
      headers: headers(teacherToken(app)),
    });
    expect(bogus.statusCode).toBe(400);
    expect(badSort.statusCode).toBe(400);
    expect(goodSort.statusCode).toBe(200);
  });

  it("given an oversized id, should reject it before the handler", async () => {
    // Fastify's default `maxParamLength` (100) answers 414 before the contract sees the param; the
    // schema's 128-char cap is the defence-in-depth for any server configured with a larger limit.
    const res = await app.inject({
      method: "GET",
      url: `/api/workshops/${"x".repeat(129)}`,
      headers: headers(teacherToken(app)),
    });
    expect(res.statusCode).toBe(414);
  });

  it("given an unknown body key, should reject the create body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops",
      headers: headers(adminToken(app)),
      payload: { ...workshop, extra: "nope" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockCreateWorkshop).not.toHaveBeenCalled();
  });

  it("given a refused transition, should return the structured details", async () => {
    mockTransitionWorkshop.mockRejectedValueOnce(
      new ConflictError("This workshop cannot be completed yet", "illegal_workshop_transition", {
        from: "open",
        to: "completed",
        blockers: ["workshop_not_finished"],
      }),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-updated-at": "2026-03-01T10:00:00.000Z" },
      payload: { to: "completed" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      type: "illegal_workshop_transition",
      details: { from: "open", to: "completed", blockers: ["workshop_not_finished"] },
    });
  });

  it("given a teacher, should forbid cancel/complete but allow publish", async () => {
    const headersWithOcc = {
      ...headers(teacherToken(app)),
      "x-expected-updated-at": "2026-03-01T10:00:00.000Z",
    };
    const cancel = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: headersWithOcc,
      payload: { to: "cancelled", reason: "Venue flooded" },
    });
    const complete = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: headersWithOcc,
      payload: { to: "completed" },
    });
    const publish = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: headersWithOcc,
      payload: { to: "open" },
    });
    expect(cancel.statusCode).toBe(403);
    expect(complete.statusCode).toBe(403);
    expect(publish.statusCode).toBe(200);
    expect(mockTransitionWorkshop).toHaveBeenCalledTimes(1);
  });

  it("given a read-only role, should mask participant phone numbers", async () => {
    const readOnly = await app.inject({
      method: "GET",
      url: "/api/workshops/w1",
      headers: headers(assistantTeacherToken(app)),
    });
    const writer = await app.inject({
      method: "GET",
      url: "/api/workshops/w1",
      headers: headers(teacherToken(app)),
    });
    expect(readOnly.statusCode).toBe(200);
    expect(writer.statusCode).toBe(200);
    expect(mockGetWorkshop).toHaveBeenNthCalledWith(1, "w1", { includeContactDetails: false });
    expect(mockGetWorkshop).toHaveBeenNthCalledWith(2, "w1", { includeContactDetails: true });
  });

  it("given a teacher, should forbid restore at the module gate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/restore",
      headers: headers(teacherToken(app)),
    });
    expect(res.statusCode).toBe(403);
    expect(mockRestoreWorkshop).not.toHaveBeenCalled();
  });

  it("given an assistant teacher, should forbid update, scores and evaluation", async () => {
    const token = assistantTeacherToken(app);
    const update = await app.inject({
      method: "PATCH",
      url: "/api/workshops/w1",
      headers: headers(token),
      payload: { title: "Changed" },
    });
    const scores = await app.inject({
      method: "PUT",
      url: "/api/workshops/w1/scores",
      headers: headers(token),
      payload: {
        scores: [{ participantId: "p1", criterionName: "Practical", score: 5, maxScore: 10 }],
      },
    });
    const evaluate = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/completion/evaluate",
      headers: headers(token),
    });
    expect(update.statusCode).toBe(403);
    expect(scores.statusCode).toBe(403);
    expect(evaluate.statusCode).toBe(403);
    expect(mockUpdateWorkshop).not.toHaveBeenCalled();
    expect(mockSaveScores).not.toHaveBeenCalled();
    expect(mockEvaluateCompletion).not.toHaveBeenCalled();
  });

  it("given an admin, should update, save scores and evaluate", async () => {
    const update = await app.inject({
      method: "PATCH",
      url: "/api/workshops/w1",
      headers: headers(adminToken(app)),
      payload: { title: "Changed" },
    });
    const scores = await app.inject({
      method: "PUT",
      url: "/api/workshops/w1/scores",
      headers: headers(adminToken(app)),
      payload: {
        scores: [{ participantId: "p1", criterionName: "Practical", score: 5, maxScore: 10 }],
      },
    });
    const evaluate = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/completion/evaluate",
      headers: headers(adminToken(app)),
    });
    expect(update.statusCode).toBe(200);
    expect(scores.statusCode).toBe(200);
    expect(evaluate.statusCode).toBe(200);
    expect(mockUpdateWorkshop).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ title: "Changed" }),
    );
    expect(mockEvaluateCompletion).toHaveBeenCalledWith("w1");
  });

  it("given a teacher, should forbid archive and bulk archive; an admin succeeds", async () => {
    const forbidden = await app.inject({
      method: "DELETE",
      url: "/api/workshops/w1",
      headers: headers(teacherToken(app)),
      payload: { deletionReason: "Cleanup" },
    });
    const bulkForbidden = await app.inject({
      method: "POST",
      url: "/api/workshops/bulk-delete",
      headers: headers(teacherToken(app)),
      payload: { ids: ["w1"] },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(bulkForbidden.statusCode).toBe(403);
    expect(mockDeleteWorkshop).not.toHaveBeenCalled();

    const deleted = await app.inject({
      method: "DELETE",
      url: "/api/workshops/w1",
      headers: headers(adminToken(app)),
      payload: { deletionReason: "Cleanup" },
    });
    const bulk = await app.inject({
      method: "POST",
      url: "/api/workshops/bulk-delete",
      headers: headers(adminToken(app)),
      payload: { ids: ["w1"] },
    });
    const restored = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/restore",
      headers: headers(adminToken(app)),
    });
    expect(deleted.statusCode).toBe(200);
    expect(bulk.statusCode).toBe(200);
    expect(restored.statusCode).toBe(200);
    expect(mockDeleteWorkshop).toHaveBeenCalledWith("w1", expect.any(String), "Cleanup");
    expect(mockDeleteWorkshops).toHaveBeenCalledWith(["w1"], expect.any(String), null);
  });

  it("given a stale transition, should keep the domain 409", async () => {
    mockTransitionWorkshop.mockRejectedValueOnce(
      new ConflictError(
        "This workshop was modified by another user — reload and try again",
        "stale_workshop",
      ),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/transition",
      headers: { ...headers(adminToken(app)), "x-expected-updated-at": "2026-03-01T10:00:00.000Z" },
      payload: { to: "open" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "stale_workshop" });
  });

  it("given a teacher, should return the validated metrics envelope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workshops/metrics",
      headers: headers(teacherToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: { total: 0, upcoming: 0, ongoing: 0, finished: 0, participants: 0 },
    });
  });
});

describe("workshops completion and Setup access", () => {
  let app: App;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    mockSavePreferences
      .mockReset()
      .mockResolvedValue({ defaultMinAttendancePct: 80, defaultMinScorePct: null });
    mockIssueCertificates.mockReset().mockResolvedValue({ issued: [], rows: [] });
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const preferences = { defaultMinAttendancePct: 80, defaultMinScorePct: null };

  it("given a teacher, should forbid changing Setup defaults", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/workshops/setup/preferences",
      headers: headers(teacherToken(app)),
      payload: preferences,
    });
    expect(res.statusCode).toBe(403);
    expect(mockSavePreferences).not.toHaveBeenCalled();
  });

  it("given an admin, should save Setup defaults", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/workshops/setup/preferences",
      headers: headers(adminToken(app)),
      payload: preferences,
    });
    expect(res.statusCode).toBe(200);
    expect(mockSavePreferences).toHaveBeenCalledWith(preferences);
  });

  it("given an out-of-range default, should reject it with 400", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/workshops/setup/preferences",
      headers: headers(adminToken(app)),
      payload: { defaultMinAttendancePct: 120, defaultMinScorePct: null },
    });
    expect(res.statusCode).toBe(400);
  });

  it("given an assistant teacher (read only), should forbid issuing certificates", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workshops/w1/certificates",
      headers: headers(assistantTeacherToken(app)),
      payload: { participantIds: [] },
    });
    expect(res.statusCode).toBe(403);
    expect(mockIssueCertificates).not.toHaveBeenCalled();
  });
});
