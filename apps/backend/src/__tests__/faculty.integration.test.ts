import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, viewerToken } from "./helpers/tokens.js";
import type { Faculty } from "@mms/shared";

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
  const demoWs = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo",
    createdAt: "2026-01-01",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (sub: string) => (sub === "demo" ? demoWs : null)),
  };
});

vi.mock("../services/facultyValidationService.js", () => ({
  validateFacultyDynamic: vi.fn().mockResolvedValue(undefined),
}));

const mockLoadFacultyPage = vi.fn();
const mockCreateFaculty = vi.fn();
const mockUpdateFacultyById = vi.fn();
const mockLoadFacultyById = vi.fn();
const mockDeleteFacultyById = vi.fn();
const mockCountFaculty = vi.fn();

vi.mock("../faculty/use-cases/facultyUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../faculty/use-cases/facultyUseCases.js")>();
  return {
    ...actual,
    facultyUseCases: {
      ...actual.facultyUseCases,
      loadFacultyPage: (...args: unknown[]) => mockLoadFacultyPage(...args),
      createFaculty: (...args: unknown[]) => mockCreateFaculty(...args),
      updateFacultyById: (...args: unknown[]) => mockUpdateFacultyById(...args),
      loadFacultyById: (...args: unknown[]) => mockLoadFacultyById(...args),
      deleteFacultyById: (...args: unknown[]) => mockDeleteFacultyById(...args),
      countFaculty: (...args: unknown[]) => mockCountFaculty(...args),
      sanitizeFacultyForViewer: async (item: unknown) => item,
      sanitizeFacultyListForViewer: async (list: unknown) => list,
    },
  };
});

describe("Faculty REST API Endpoints Integration", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const sampleFaculty: Faculty = {
    id: "fac-1",
    contactId: "cnt-1",
    name: "Dr. Ahmad",
    status: "active",
    department: "Arabic",
    designation: "Senior Lecturer",
  };

  const authHeaders = (token: string) => ({
    host: "demo.localhost",
    authorization: `Bearer ${token}`,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/faculty lists faculty members successfully", async () => {
    mockLoadFacultyPage.mockResolvedValueOnce({
      faculty: [sampleFaculty],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty",
      headers: authHeaders(adminToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().faculty).toHaveLength(1);
  });

  it("GET /api/v1/tenant/faculty routes to faculty list via URL rewrite", async () => {
    mockLoadFacultyPage.mockResolvedValueOnce({
      faculty: [sampleFaculty],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tenant/faculty",
      headers: authHeaders(adminToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().faculty[0].id).toBe("fac-1");
  });

  it("POST /api/faculty creates a new faculty member for authorized user", async () => {
    mockCreateFaculty.mockResolvedValueOnce({ record: sampleFaculty, restored: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty",
      headers: authHeaders(adminToken(app)),
      payload: { contactId: "cnt-1", status: "active", department: "Arabic" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
  });

  it("POST /api/faculty rejects creation when user lacks write permissions", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty",
      headers: authHeaders(viewerToken(app)),
      payload: { contactId: "cnt-1" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /api/faculty/:id returns single faculty member", async () => {
    mockLoadFacultyById.mockResolvedValueOnce(sampleFaculty);
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty/fac-1",
      headers: authHeaders(adminToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().faculty.id).toBe("fac-1");
  });

  it("PUT /api/faculty/:id updates faculty record", async () => {
    mockUpdateFacultyById.mockResolvedValueOnce({ ...sampleFaculty, designation: "Professor" });
    const res = await app.inject({
      method: "PUT",
      url: "/api/faculty/fac-1",
      headers: authHeaders(adminToken(app)),
      payload: { designation: "Professor" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().faculty.designation).toBe("Professor");
  });

  it("DELETE /api/faculty/:id soft-deletes faculty member", async () => {
    mockDeleteFacultyById.mockResolvedValueOnce(true);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/faculty/fac-1",
      headers: authHeaders(adminToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("GET /api/faculty/count returns entity count", async () => {
    mockCountFaculty.mockResolvedValueOnce(42);
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty/count",
      headers: authHeaders(adminToken(app)),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 42 });
  });
});
