import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleDeleteFaculty,
  handleUpdateFaculty,
} from "../routes/tenant/faculty/facultyMutationRouteHandlers.js";
import { FacultyRoleSyncForbiddenError } from "../faculty/use-cases/facultyLinkedUserRoleSync.js";

const { updateFacultyById, deleteFacultyById, validateFacultyDynamic } = vi.hoisted(() => ({
  updateFacultyById: vi.fn(),
  deleteFacultyById: vi.fn(),
  validateFacultyDynamic: vi.fn(),
}));

vi.mock("../services/rbacService.js", () => ({
  canWriteCollection: () => true,
  canDeleteCollection: () => true,
}));
vi.mock("../services/facultyValidationService.js", () => ({
  validateFacultyDynamic: (...args: unknown[]) => validateFacultyDynamic(...args),
}));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, work: () => Promise<unknown>) => work(),
}));
vi.mock("../faculty/use-cases/facultyUseCases.js", () => ({
  facultyUseCases: {
    updateFacultyById: (...args: unknown[]) => updateFacultyById(...args),
    deleteFacultyById: (...args: unknown[]) => deleteFacultyById(...args),
  },
}));
vi.mock("../routes/tenant/faculty/facultyRouteHelpers.js", () => ({
  auditFaculty: vi.fn(),
  sanitizeOneFacultyForUser: async (record: unknown) => record,
}));

const REQUEST = {
  user: {
    id: "u-actor",
    name: "Actor",
    email: "actor@example.test",
    role: "admin",
    workspaceSubdomain: "demo",
  },
  tenant: { id: "demo" },
  headers: { "accept-language": "en" },
  log: { error: vi.fn() },
} as const;

const BODY = { contactId: "c-1", designationId: "d-1" };

describe("Faculty update error taxonomy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateFacultyDynamic.mockResolvedValue(undefined);
  });

  it("maps a linked-user role-sync denial to 403 instead of 500", async () => {
    updateFacultyById.mockRejectedValueOnce(new FacultyRoleSyncForbiddenError());

    const response = await handleUpdateFaculty({
      params: { id: "f-1" },
      body: BODY,
      request: REQUEST,
    } as never);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ type: "forbidden" });
  });

  it("maps a duplicate employee id to 409 instead of 500", async () => {
    updateFacultyById.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
    );

    const response = await handleUpdateFaculty({
      params: { id: "f-1" },
      body: BODY,
      request: REQUEST,
    } as never);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ type: "conflict" });
  });

  it("keeps field validation failures as 400", async () => {
    updateFacultyById.mockRejectedValueOnce(
      Object.assign(new Error("Employee ID is required"), { statusCode: 400 }),
    );

    const response = await handleUpdateFaculty({
      params: { id: "f-1" },
      body: BODY,
      request: REQUEST,
    } as never);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      type: "validation_error",
      message: "Employee ID is required",
    });
  });

  it("still surfaces an unexpected failure as 500", async () => {
    updateFacultyById.mockRejectedValueOnce(new Error("connection reset"));

    const response = await handleUpdateFaculty({
      params: { id: "f-1" },
      body: BODY,
      request: REQUEST,
    } as never);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ type: "server_error" });
  });
});

describe("Faculty delete error taxonomy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a subordinate-required rejection to 409", async () => {
    deleteFacultyById.mockRejectedValueOnce(
      Object.assign(new Error("Cannot delete faculty member with 2 active subordinate(s)"), {
        statusCode: 409,
      }),
    );

    const response = await handleDeleteFaculty({
      params: { id: "f-1" },
      body: {},
      request: REQUEST,
    } as never);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ type: "conflict" });
  });

  it("maps a validation rejection to 400 instead of 500", async () => {
    deleteFacultyById.mockRejectedValueOnce(
      Object.assign(new Error("Reassignment target is required"), { statusCode: 400 }),
    );

    const response = await handleDeleteFaculty({
      params: { id: "f-1" },
      body: {},
      request: REQUEST,
    } as never);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ type: "validation_error" });
  });
});
