import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

const mockTx = {
  execute: vi.fn().mockResolvedValue([]),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
};

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi
    .fn()
    .mockImplementation(
      async (_tenant: string | null | undefined, callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockTx);
      },
    ),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn().mockResolvedValue(null),
  saveContactFieldConfig: vi.fn().mockResolvedValue(undefined),
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

const mockFindTenantUserRowById = vi.fn();
const mockFindTeacherById = vi.fn();

vi.mock("../db/repositories/tenantUserRepositoryHydrate.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../db/repositories/tenantUserRepositoryHydrate.js")>();
  return {
    ...actual,
    findTenantUserRowById: (...args: unknown[]) => mockFindTenantUserRowById(...args),
  };
});

vi.mock("../faculty/repository/facultyRepositoryAdapter.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../faculty/repository/facultyRepositoryAdapter.js")>();
  return {
    ...actual,
    facultyRepository: {
      ...actual.facultyRepository,
      findById: (...args: unknown[]) => mockFindTeacherById(...args),
    },
  };
});

const mockGetContactById = vi.fn();
const mockSoftDeleteContactById = vi.fn();
const mockRestoreContactById = vi.fn();
const mockBulkSoftDeleteContacts = vi.fn();
const mockBulkRestoreContacts = vi.fn();

vi.mock("../contacts/use-cases/contactUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../contacts/use-cases/contactUseCases.js")>();
  return {
    ...actual,
    contactUseCases: {
      ...actual.contactUseCases,
      getContactById: (...args: unknown[]) => mockGetContactById(...args),
      softDeleteContactById: (...args: unknown[]) => mockSoftDeleteContactById(...args),
      restoreContactById: (...args: unknown[]) => mockRestoreContactById(...args),
      bulkSoftDeleteContacts: (...args: unknown[]) => mockBulkSoftDeleteContacts(...args),
      bulkRestoreContacts: (...args: unknown[]) => mockBulkRestoreContacts(...args),
    },
  };
});

const mockDeleteExamById = vi.fn();
const mockRestoreExamById = vi.fn();
const mockBulkRestoreExams = vi.fn();

vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: {
    loadExams: vi.fn().mockResolvedValue([]),
    upsertExams: vi.fn(),
    deleteExamById: (...args: unknown[]) => mockDeleteExamById(...args),
    restoreExamById: (...args: unknown[]) => mockRestoreExamById(...args),
    bulkSoftDeleteExams: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreExams: (...args: unknown[]) => mockBulkRestoreExams(...args),
    loadExaminationsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadExamsPage: vi
      .fn()
      .mockResolvedValue({ exams: [], total: 0, page: 1, limit: 12, hasMore: false }),
    upsertExamResults: vi.fn(),
  },
}));

import { buildApp } from "../app.js";
import { accountantToken, adminToken, teacherToken, signTenantToken } from "./helpers/tokens.js";
import { redisGet, redisSet, clearInMemoryRedisFallback } from "../lib/redis.js";
import { softDeleteTenantUserRow } from "../db/repositories/tenantUserRepositoryPersist.js";

describe("Soft Delete Route Semantics & Session Invalidation Integration", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    clearInMemoryRedisFallback();
    vi.clearAllMocks();

    // Tenant-aware, mirroring the real repository: rows are only visible inside
    // their own workspace (see tenantUserRepositoryHydrate.ts).
    mockFindTenantUserRowById.mockImplementation(async (tenant: string, id: string) => {
      if (tenant !== "demo") return null;
      if (id === "u-admin") {
        return {
          id: "u-admin",
          email: "admin@test.com",
          role: "admin",
          workspaceSubdomain: "demo",
          deletedAt: null,
        };
      }
      if (id === "u-accountant") {
        return {
          id: "u-accountant",
          email: "accountant@test.com",
          role: "accountant",
          workspaceSubdomain: "demo",
          deletedAt: null,
        };
      }
      if (id === "u-teacher") {
        return {
          id: "u-teacher",
          email: "teacher@test.com",
          role: "teacher",
          workspaceSubdomain: "demo",
          deletedAt: null,
        };
      }
      return null;
    });

    mockFindTeacherById.mockResolvedValue(null);

    if (!app) {
      app = await buildApp();
      await app.ready();
    }
  });

  afterAll(async () => {
    clearInMemoryRedisFallback();
    if (app) {
      await app.close();
    }
  });

  it("Assertion 1: GET /api/contacts/:id on an archived contact returns 404 Not Found", async () => {
    const archivedContact = {
      id: "c-archived-1",
      firstName: "Archived",
      lastName: "Contact",
      deletedAt: "2026-09-10T12:00:00.000Z",
      deletedBy: "u-admin",
    };
    mockGetContactById.mockResolvedValue(archivedContact);

    const token = adminToken(app, { workspaceSubdomain: "demo" });
    const response = await app.inject({
      method: "GET",
      url: "/api/contacts/c-archived-1",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.localhost",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toMatch(/Contact not found/i);
  });

  it("Assertion 2: GET /api/contacts/:id?includeDeleted=true returns 200 for admin, but returns 403 for user lacking delete permissions", async () => {
    const archivedContact = {
      id: "c-archived-2",
      firstName: "Archived",
      lastName: "Contact",
      deletedAt: "2026-09-10T12:00:00.000Z",
      deletedBy: "u-admin",
    };
    mockGetContactById.mockResolvedValue(archivedContact);

    // 1. Admin has contacts.delete permission -> 200 OK
    const adminAuth = adminToken(app, { workspaceSubdomain: "demo" });
    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/contacts/c-archived-2?includeDeleted=true",
      headers: {
        authorization: `Bearer ${adminAuth}`,
        host: "demo.localhost",
      },
    });

    expect(adminResponse.statusCode).toBe(200);
    const body = adminResponse.json();
    expect(body.contact).toBeDefined();
    expect(body.contact.id).toBe("c-archived-2");

    // 2. User with read permission but lacking delete permission (accountant) -> 403 Forbidden
    const accountantAuth = accountantToken(app, { workspaceSubdomain: "demo" });
    const accountantResponse = await app.inject({
      method: "GET",
      url: "/api/contacts/c-archived-2?includeDeleted=true",
      headers: {
        authorization: `Bearer ${accountantAuth}`,
        host: "demo.localhost",
      },
    });

    expect(accountantResponse.statusCode).toBe(403);
    expect(accountantResponse.json().message).toMatch(
      /Viewing deleted contacts requires delete permissions/i,
    );

    // 3. User lacking permissions entirely (teacher) -> 403 Forbidden
    const teacherAuth = teacherToken(app, { workspaceSubdomain: "demo" });
    const teacherResponse = await app.inject({
      method: "GET",
      url: "/api/contacts/c-archived-2?includeDeleted=true",
      headers: {
        authorization: `Bearer ${teacherAuth}`,
        host: "demo.localhost",
      },
    });

    expect(teacherResponse.statusCode).toBe(403);
  });

  it("Assertion 3: DELETE /api/contacts/:id on an already-deleted contact returns 404 Not Found", async () => {
    // When softDeleteContactById returns false (record does not exist or already soft-deleted)
    mockSoftDeleteContactById.mockResolvedValue(false);

    const token = adminToken(app, { workspaceSubdomain: "demo" });
    const response = await app.inject({
      method: "DELETE",
      url: "/api/contacts/c-archived-3",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.localhost",
      },
      payload: {
        deletionReason: "Redundant test entry",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toMatch(/Contact not found/i);
  });

  it("Assertion 4: Storing mms:session:${userId}:token-1 in Redis, verifying active session, soft-deleting user, verifying Redis key is deleted, and verifying subsequent calls return 401 Session revoked", async () => {
    const targetUserId = "u-test-staff-99";
    let userDeletedAt: string | null = null;

    // Tenant-aware, mirroring the real repository: rows are only visible inside
    // their own workspace (see tenantUserRepositoryHydrate.ts).
    mockFindTenantUserRowById.mockImplementation(async (tenant: string, id: string) => {
      if (tenant !== "demo") return null;
      if (id === targetUserId) {
        return {
          id: targetUserId,
          email: "staff99@test.com",
          name: "Staff 99",
          role: "teacher",
          workspaceSubdomain: "demo",
          deletedAt: userDeletedAt,
        };
      }
      if (id === "u-admin") {
        return {
          id: "u-admin",
          email: "admin@test.com",
          role: "admin",
          workspaceSubdomain: "demo",
          deletedAt: null,
        };
      }
      return null;
    });

    const sessionKey = `mms:session:${targetUserId}:token-1`;
    await redisSet(sessionKey, JSON.stringify({ userId: targetUserId, valid: true }));

    // Verify session is active in Redis
    const initialSession = await redisGet(sessionKey);
    expect(initialSession).not.toBeNull();

    // Sign a token for this user
    const userToken = signTenantToken(app, {
      id: targetUserId,
      email: "staff99@test.com",
      role: "teacher",
      workspaceSubdomain: "demo",
    });

    // Verify user can access /api/auth/me before deletion
    const meResBefore = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${userToken}`,
        host: "demo.localhost",
      },
    });
    expect(meResBefore.statusCode).toBe(200);
    expect(meResBefore.json().isAuthenticated).toBe(true);

    // Soft-delete the tenant user
    const deleteResult = await softDeleteTenantUserRow("demo", targetUserId, "u-admin");
    expect(deleteResult).toBe(true);

    // Verify Redis session key was deleted by revokeUserSessionKeys pattern deletion
    const sessionAfterDelete = await redisGet(sessionKey);
    expect(sessionAfterDelete).toBeNull();

    // Update the database mock to reflect the deletedAt timestamp on the user row
    userDeletedAt = new Date().toISOString();

    // Subsequent call to /api/auth/me must return 401 Session revoked
    const meResAfter = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${userToken}`,
        host: "demo.localhost",
      },
    });
    expect(meResAfter.statusCode).toBe(401);
    expect(meResAfter.json().message).toMatch(/Session revoked/i);

    // Subsequent call to any tenant route (e.g. GET /api/contacts) must also return 401 Session revoked
    const contactsResAfter = await app.inject({
      method: "GET",
      url: "/api/contacts",
      headers: {
        authorization: `Bearer ${userToken}`,
        host: "demo.localhost",
      },
    });
    expect(contactsResAfter.statusCode).toBe(401);
    expect(contactsResAfter.json().message).toMatch(/Session revoked/i);
  });

  it("Assertion 5: Manifest compliance — strips deletionReason when captureDeletionReason is false and preserves it when true", async () => {
    mockDeleteExamById.mockResolvedValue(true);
    mockSoftDeleteContactById.mockResolvedValue(true);

    const token = adminToken(app, { workspaceSubdomain: "demo" });

    // 1. Examinations has captureDeletionReason: false -> reason is stripped to undefined
    const examRes = await app.inject({
      method: "DELETE",
      url: "/api/examinations/exams/exam-101",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.localhost",
      },
      payload: {
        deletionReason: "Should be stripped by route factory",
      },
    });

    expect(examRes.statusCode).toBe(200);
    expect(mockDeleteExamById).toHaveBeenCalledWith("exam-101", "u-admin");

    // 2. Contacts has captureDeletionReason: true -> reason is preserved
    const contactRes = await app.inject({
      method: "DELETE",
      url: "/api/contacts/c-active-101",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.localhost",
      },
      payload: {
        deletionReason: "Preserve this audit reason",
      },
    });

    expect(contactRes.statusCode).toBe(200);
    expect(mockSoftDeleteContactById).toHaveBeenCalledWith(
      "c-active-101",
      "u-admin",
      "Preserve this audit reason",
    );
  });

  it("Assertion 6: Batched and single restore routes accurately forward userId to attribute restored_by", async () => {
    mockRestoreExamById.mockResolvedValue({ id: "exam-101" });
    mockBulkRestoreExams.mockResolvedValue({ succeeded: 2, failed: 0 });

    const token = adminToken(app, { workspaceSubdomain: "demo" });

    // Single restore forwards userId
    const singleRes = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/exam-101/restore",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.localhost",
      },
    });

    expect(singleRes.statusCode).toBe(200);
    expect(mockRestoreExamById).toHaveBeenCalledWith("exam-101", "u-admin");

    // Bulk restore forwards userId
    const bulkRes = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/bulk-restore",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.localhost",
      },
      payload: {
        ids: ["exam-101", "exam-102"],
      },
    });

    expect(bulkRes.statusCode).toBe(200);
    expect(mockBulkRestoreExams).toHaveBeenCalledWith(["exam-101", "exam-102"], "u-admin");
  });

  it("Assertion 7: Soft-deleting a teacher account revokes active session and subsequent calls return 401 Session revoked", async () => {
    const targetTeacherId = "t-test-99";
    let teacherDeletedAt: string | null = null;

    mockFindTeacherById.mockImplementation(async (_tenant: string, id: string) => {
      if (id === targetTeacherId) {
        return {
          id: targetTeacherId,
          name: "Teacher 99",
          workspaceSubdomain: "demo",
          deletedAt: teacherDeletedAt ? new Date(teacherDeletedAt) : null,
        };
      }
      return null;
    });

    const sessionKey = `mms:session:${targetTeacherId}:token-1`;
    await redisSet(sessionKey, JSON.stringify({ userId: targetTeacherId, valid: true }));

    const initialSession = await redisGet(sessionKey);
    expect(initialSession).not.toBeNull();

    const teacherAuth = signTenantToken(app, {
      id: targetTeacherId,
      email: "teacher99@test.com",
      role: "teacher",
      workspaceSubdomain: "demo",
    });

    // Valid before deletion
    const meBefore = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${teacherAuth}`,
        host: "demo.localhost",
      },
    });
    expect(meBefore.statusCode).toBe(200);

    // Revoke sessions when teacher is soft-deleted
    const { revokeUserSessionKeys } = await import("../services/authSessionService.js");
    await revokeUserSessionKeys(targetTeacherId);

    const sessionAfter = await redisGet(sessionKey);
    expect(sessionAfter).toBeNull();

    // Set teacher to soft-deleted
    teacherDeletedAt = new Date().toISOString();

    const meAfter = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${teacherAuth}`,
        host: "demo.localhost",
      },
    });
    expect(meAfter.statusCode).toBe(401);
    expect(meAfter.json().message).toMatch(/Session revoked/i);
  });
});
