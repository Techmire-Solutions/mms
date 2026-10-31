import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { ConflictError } from "../lib/httpErrors.js";
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

vi.mock("../workshops/use-cases/workshopsUseCases.js", () => ({
  workshopsUseCases: {
    listWorkshops: (...args: unknown[]) => mockListWorkshops(...args),
    createWorkshop: (...args: unknown[]) => mockCreateWorkshop(...args),
    saveAttendanceDay: (...args: unknown[]) => mockSaveAttendanceDay(...args),
    getWorkshop: vi.fn(),
    updateWorkshop: vi.fn(),
    deleteWorkshops: vi.fn(),
    restoreWorkshop: vi.fn(),
    addParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    saveScores: vi.fn(),
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

vi.mock("../workshops/use-cases/workshopsCompletionUseCases.js", () => ({
  workshopsCompletionUseCases: {
    getCompletion: vi.fn().mockResolvedValue([]),
    evaluateCompletion: vi.fn().mockResolvedValue([]),
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

describe("workshops REST access and validation", () => {
  let app: App;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    mockListWorkshops
      .mockReset()
      .mockResolvedValue({ workshops: [], total: 0, page: 1, limit: 15, hasMore: false });
    mockCreateWorkshop.mockReset();
    mockSaveAttendanceDay.mockReset().mockResolvedValue([]);
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
