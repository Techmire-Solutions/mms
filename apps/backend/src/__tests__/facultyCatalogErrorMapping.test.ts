/**
 * Faculty catalog route error mapping.
 *
 * Domain failures keep their 400/404/409 mapping; an infrastructure/DB failure
 * must be a logged 500, not a "validation_error" that blames the caller.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "../lib/httpErrors.js";

const mocks = vi.hoisted(() => ({
  saveFacultyDesignation: vi.fn(),
  softDeleteFacultyDesignation: vi.fn(),
  restoreFacultyDesignation: vi.fn(),
  saveFacultyDepartment: vi.fn(),
  restoreFacultyDepartment: vi.fn(),
  findFacultyDepartmentById: vi.fn(),
  reconcileDesignationContacts: vi.fn(),
  broadcastCollection: vi.fn(),
}));

vi.mock("../faculty/use-cases/facultyCatalogUseCases.js", () => ({
  listFacultyDesignations: vi.fn(),
  listFacultyDesignationAssignments: vi.fn(),
  saveFacultyDesignation: mocks.saveFacultyDesignation,
  softDeleteFacultyDesignation: mocks.softDeleteFacultyDesignation,
  restoreFacultyDesignation: mocks.restoreFacultyDesignation,
  listFacultyDepartments: vi.fn(),
  saveFacultyDepartment: mocks.saveFacultyDepartment,
  softDeleteFacultyDepartment: vi.fn(),
  restoreFacultyDepartment: mocks.restoreFacultyDepartment,
  findFacultyDepartmentById: mocks.findFacultyDepartmentById,
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileDesignationContacts: mocks.reconcileDesignationContacts,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: mocks.broadcastCollection,
}));

vi.mock("../routes/tenant/faculty/facultyRouteHelpers.js", () => ({
  auditFaculty: vi.fn().mockResolvedValue(undefined),
}));

import {
  handleDeleteDesignation,
  handleRestoreDesignation,
  handleSaveDesignation,
} from "../routes/tenant/faculty/facultyDesignationRouteHandlers.js";
import {
  handleRestoreDepartment,
  handleSaveDepartment,
} from "../routes/tenant/faculty/facultyDepartmentRouteHandlers.js";

const ADMIN = { id: "u-admin", role: "admin", email: "admin@test.com" };

function makeRequest() {
  const log = { error: vi.fn() };
  return { request: { user: ADMIN, tenant: { id: "demo" }, log } as never, log };
}

describe("faculty catalog error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a logged 500 when designation save hits an infrastructure failure", async () => {
    mocks.saveFacultyDesignation.mockRejectedValue(new Error("connection terminated"));
    const { request, log } = makeRequest();

    const result = await handleSaveDesignation({
      params: { id: "des-1" },
      body: { name: "Mudarris", departmentId: "dept-1" },
      request,
    } as never);

    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({ type: "server_error" });
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("keeps a typed validation failure as 400 without logging", async () => {
    mocks.saveFacultyDesignation.mockRejectedValue(new ValidationError("Name is required"));
    const { request, log } = makeRequest();

    const result = await handleSaveDesignation({
      params: { id: "des-1" },
      body: { name: "" },
      request,
    } as never);

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ type: "validation_error", message: "Name is required" });
    expect(log.error).not.toHaveBeenCalled();
  });

  it("keeps a typed conflict (409) on designation delete", async () => {
    mocks.softDeleteFacultyDesignation.mockRejectedValue(
      new ConflictError("Designation has dependent designations"),
    );
    const { request } = makeRequest();

    const result = await handleDeleteDesignation({ params: { id: "des-1" }, request } as never);

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ type: "conflict" });
  });

  it("returns a logged 500 when designation restore hits an infrastructure failure", async () => {
    mocks.restoreFacultyDesignation.mockRejectedValue(new Error("pool exhausted"));
    const { request, log } = makeRequest();

    const result = await handleRestoreDesignation({ params: { id: "des-1" }, request } as never);

    expect(result.status).toBe(500);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("returns a logged 500 when department save hits an infrastructure failure", async () => {
    mocks.saveFacultyDepartment.mockRejectedValue(new Error("deadlock detected"));
    const { request, log } = makeRequest();

    const result = await handleSaveDepartment({
      params: { id: "dept-1" },
      body: { name: "Hifz" },
      request,
    } as never);

    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({ type: "server_error" });
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("returns a logged 500 when department restore hits an infrastructure failure", async () => {
    mocks.restoreFacultyDepartment.mockRejectedValue(new Error("statement timeout"));
    const { request, log } = makeRequest();

    const result = await handleRestoreDepartment({ params: { id: "dept-1" }, request } as never);

    expect(result.status).toBe(500);
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
