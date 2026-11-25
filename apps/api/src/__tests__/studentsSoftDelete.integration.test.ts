import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken } from "./helpers/tokens.js";

vi.mock("../services/rbacService.js", (io) =>
  import("./helpers/authGuardMocks.js").then((m) => m.rbacServiceMock(io)),
);
vi.mock("../services/globalSettingsService.js", (io) =>
  import("./helpers/authGuardMocks.js").then((m) => m.globalSettingsServiceMock(io)),
);
vi.mock("../middleware/accountDeletionGuard.js", (io) =>
  import("./helpers/authGuardMocks.js").then((m) => m.accountDeletionGuardMock(io)),
);
vi.mock("@mms/be-core/audit", (io) =>
  import("./helpers/authGuardMocks.js").then((m) => m.auditMock(io)),
);

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: vi
    .fn()
    .mockImplementation(
      async (_tenant: string | null | undefined, callback: (tx?: unknown) => Promise<unknown>) => {
        return callback({ execute: vi.fn().mockResolvedValue(undefined) });
      },
    ),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  deleteRefreshTokensForUser: vi.fn(),
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),

  authArtifactUserScopeKey: vi.fn(() => ""),
  authArtifactWorkspaceScopeKey: vi.fn(() => ""),
  deleteAuthArtifact: vi.fn().mockResolvedValue(undefined),
  findAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  tryClaimAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  updateAuthArtifactPayload: vi.fn().mockResolvedValue(undefined),
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

const mockLoadStudentsPage = vi.fn();
const mockDeleteStudentById = vi.fn();
const mockRestoreStudentById = vi.fn();

vi.mock("@mms/mod-students/backend/use-cases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-students/backend/use-cases")>();
  return {
    ...actual,
    studentUseCases: {
      ...actual.studentUseCases,
      loadStudentsPage: (...args: unknown[]) => mockLoadStudentsPage(...args),
      softDeleteStudentById: (...args: unknown[]) => mockDeleteStudentById(...args),
      restoreStudentById: (...args: unknown[]) => mockRestoreStudentById(...args),
      sanitizeStudentForViewer: async (student: unknown) => student,
      sanitizeStudentsForViewer: async (students: unknown) => students,
    },
  };
});

describe("students soft delete routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("DELETE /api/students/:id soft-deletes student", async () => {
    mockDeleteStudentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/students/s1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Left country" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteStudentById).toHaveBeenCalledWith("s1", "u-admin", "Left country");
    await app.close();
  });

  it("POST /api/students/:id/restore restores a student", async () => {
    mockRestoreStudentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/s1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreStudentById).toHaveBeenCalledWith("s1", "u-admin");
    await app.close();
  });

  it("GET /api/students lists with includeDeleted options", async () => {
    mockLoadStudentsPage.mockResolvedValue({
      students: [{ id: "s-deleted", deletedAt: "2026-01-15T00:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/students?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadStudentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    const body = res.json() as { students: Array<{ id: string; deletedAt?: string | null }> };
    expect(body.students).toHaveLength(1);
    expect(body.students.every((row) => Boolean(row.deletedAt))).toBe(true);
    await app.close();
  });
});
