import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, viewerToken } from "./helpers/tokens.js";

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

const mockCreateFaculty = vi.fn();
const mockUpdateFacultyById = vi.fn();
const mockCheckFacultyRegistrationDuplicate = vi.fn();
const mockMigrateFacultyMissingEmployeeIds = vi.fn();
const mockLoadFacultyPage = vi.fn();
const mockBulkUpdateFacultySpecialization = vi.fn();

vi.mock("../faculty/use-cases/facultyUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../faculty/use-cases/facultyUseCases.js")>();
  const mocked = {
    ...actual.facultyUseCases,
    createFaculty: (...args: unknown[]) => mockCreateFaculty(...args),
    updateFacultyById: (...args: unknown[]) => mockUpdateFacultyById(...args),
    checkFacultyRegistrationDuplicate: (...args: unknown[]) =>
      mockCheckFacultyRegistrationDuplicate(...args),
    migrateFacultyMissingEmployeeIds: (...args: unknown[]) =>
      mockMigrateFacultyMissingEmployeeIds(...args),
    loadFacultyPage: (...args: unknown[]) => mockLoadFacultyPage(...args),
    bulkUpdateFacultySpecialization: (...args: unknown[]) =>
      mockBulkUpdateFacultySpecialization(...args),
    sanitizeFacultyForViewer: async (faculty: unknown) => faculty,
    sanitizeFacultyListForViewer: async (facultyList: unknown) => facultyList,
  };
  return {
    ...actual,
    facultyUseCases: mocked,
  };
});

vi.mock("../services/facultyValidationService.js", () => ({
  validateFacultyDynamic: vi.fn().mockResolvedValue(undefined),
}));

describe("faculty write contact-profile SSOT", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("POST /api/faculty strips contact profile dual-write keys before create", async () => {
    mockCreateFaculty.mockImplementation(async (teacher: Record<string, unknown>) => ({
      record: teacher,
      restored: false,
    }));
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        contactId: "c-300",
        specialization: "Hifz",
        status: "active",
        name: "Should Strip",
        phone: "+923001112233",
        email: "strip@example.com",
        firstName: "Should",
        lastName: "Strip",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ success: true, faculty: { contactId: "c-300" } });
    expect(mockCreateFaculty).toHaveBeenCalled();
    const created = mockCreateFaculty.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(created.contactId).toBe("c-300");
    expect(created.specialization).toBe("Hifz");
    expect(created.name).toBeUndefined();
    expect(created.phone).toBeUndefined();
    expect(created.email).toBeUndefined();
    expect(created.firstName).toBeUndefined();
    expect(created.lastName).toBeUndefined();
    await app.close();
  });

  it("POST /api/faculty returns 200 when the create restored an archived faculty member", async () => {
    mockCreateFaculty.mockImplementation(async (teacher: Record<string, unknown>) => ({
      record: { ...teacher, id: "t-archived" },
      restored: true,
    }));
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        contactId: "c-archived",
        specialization: "Qiraat",
        status: "active",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { success: boolean; faculty?: { id?: string } };
    expect(body.success).toBe(true);
    expect(body.faculty?.id).toBe("t-archived");
    await app.close();
  });

  it("PUT /api/faculty/:id strips contact profile keys on update", async () => {
    mockUpdateFacultyById.mockImplementation(
      async (_id: string, teacher: Record<string, unknown>) => teacher,
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/faculty/t1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        contactId: "c-300",
        specialization: "Tajweed",
        status: "active",
        name: "Dual Write",
        gender: "male",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockUpdateFacultyById).toHaveBeenCalled();
    const updated = mockUpdateFacultyById.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updated.specialization).toBe("Tajweed");
    expect(updated.name).toBeUndefined();
    expect(updated.gender).toBeUndefined();
    await app.close();
  });

  it("POST /api/faculty rejects empty-string contactId", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        contactId: "",
        specialization: "Hifz",
        status: "active",
        name: "Orphan",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(mockCreateFaculty).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/faculty/duplicate-check returns the conflict reason for writers", async () => {
    mockCheckFacultyRegistrationDuplicate.mockResolvedValue({ reason: "employeeId" });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/duplicate-check",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: { contactId: "c-300", employeeId: "TCH-0001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reason: "employeeId" });
    expect(mockCheckFacultyRegistrationDuplicate).toHaveBeenCalledWith({
      contactId: "c-300",
      employeeId: "TCH-0001",
    });
    await app.close();
  });

  it("POST /api/faculty/duplicate-check rejects non-writers", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/duplicate-check",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: { contactId: "c-300" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockCheckFacultyRegistrationDuplicate).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/faculty/migrate-employee-ids backfills for setup writers", async () => {
    mockMigrateFacultyMissingEmployeeIds.mockResolvedValue({ updated: 3 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/migrate-employee-ids",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, updated: 3 });
    expect(mockMigrateFacultyMissingEmployeeIds).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("POST /api/faculty/migrate-employee-ids rejects non-setup-writers", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/migrate-employee-ids",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(mockMigrateFacultyMissingEmployeeIds).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/faculty forwards gender and quickFilter to the list page", async () => {
    mockLoadFacultyPage.mockResolvedValue({
      faculty: [{ id: "t1", specialization: "Hifz", status: "active" }],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty?page=1&gender=male&quickFilter=active&specialization=Hifz",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { faculty?: unknown[]; total: number };
    expect(body.faculty).toHaveLength(1);
    expect(body.total).toBe(1);
    const query = mockLoadFacultyPage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(query.gender).toBe("male");
    expect(query.quickFilter).toBe("active");
    expect(query.specialization).toBe("Hifz");
    await app.close();
  });

  it("POST /api/faculty/bulk-specialization updates specialization for writers", async () => {
    mockBulkUpdateFacultySpecialization.mockResolvedValueOnce({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/bulk-specialization",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        ids: ["t1", "t2"],
        specialization: "Tajweed",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkUpdateFacultySpecialization).toHaveBeenCalledWith(["t1", "t2"], "Tajweed");
    await app.close();
  });

  it("POST /api/faculty/bulk-specialization rejects non-writers", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/bulk-specialization",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        ids: ["t1"],
        specialization: "Hifz",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockBulkUpdateFacultySpecialization).not.toHaveBeenCalled();
    await app.close();
  });
});
