import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, signTenantToken } from "./helpers/tokens.js";

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
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockLoadSessionsByIds = vi.fn();
const mockUpdateSessionById = vi.fn();

vi.mock("../sessions/use-cases/sessionsUseCases.js", () => ({
  sessionsUseCases: {
    loadSessionsByIds: (...args: unknown[]) => mockLoadSessionsByIds(...args),
    updateSessionById: (...args: unknown[]) => mockUpdateSessionById(...args),
  },
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi
    .fn()
    .mockResolvedValue({ hashPrevious: "0", hashCurrent: "1", canonicalPayload: "{}" }),
  mapActionStringToAuditType: () => "UPDATE",
}));

const SESSION = {
  id: "sess-1",
  name: "Hifz 2026",
  status: "in_progress",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  updatedAt: "2026-03-01T10:00:00.000Z",
  version: 3,
  classes: [{ id: "c1", name: "Class A", timetables: [] }],
};

const ROWS = [
  {
    classId: "c1",
    date: "2026-07-01",
    startTime: "09:00",
    endTime: "10:00",
    subject: "Tajweed",
    subjectId: "subj-1",
  },
];

function headers(token: string) {
  return { host: "demo.localhost", authorization: `Bearer ${token}` };
}

describe("session timetable import authorization", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("given a principal (write + manage, no override_lock), should derive the lock override from the permission", async () => {
    // Arrange
    mockLoadSessionsByIds.mockResolvedValueOnce([SESSION]);
    mockUpdateSessionById.mockResolvedValueOnce(SESSION);
    const app = await buildApp();

    // Act
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/sess-1/timetable/import",
      headers: headers(signTenantToken(app, { role: "principal", id: "u-principal" })),
      payload: { rows: ROWS, dryRun: false },
    });

    // Assert
    expect(res.statusCode, res.body).toBe(200);
    expect(mockUpdateSessionById).toHaveBeenCalledTimes(1);
    expect(mockUpdateSessionById.mock.calls[0]?.[2]).toMatchObject({
      canOverrideLock: false,
      lockOverrideReason: "Timetable import",
    });
  });

  it("given an admin (delete/override_lock), should allow the lock override", async () => {
    // Arrange
    mockLoadSessionsByIds.mockResolvedValueOnce([SESSION]);
    mockUpdateSessionById.mockResolvedValueOnce(SESSION);
    const app = await buildApp();

    // Act
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/sess-1/timetable/import",
      headers: headers(adminToken(app)),
      payload: { rows: ROWS, dryRun: false },
    });

    // Assert
    expect(res.statusCode, res.body).toBe(200);
    expect(mockUpdateSessionById).toHaveBeenCalledTimes(1);
    expect(mockUpdateSessionById.mock.calls[0]?.[2]).toMatchObject({ canOverrideLock: true });
  });
});
