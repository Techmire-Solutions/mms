/**
 * Faculty catalog route error mapping.
 *
 * Domain failures keep their 400/404/409 mapping; an infrastructure/DB failure
 * must be a logged 500, not a "validation_error" that blames the caller.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "@mms/be-core/http/errors";

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

vi.mock("../use-cases/facultyCatalogUseCases.js", () => ({
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

vi.mock("../deps.js", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  reconcileDesignationContacts: mocks.reconcileDesignationContacts,
}));

vi.mock("@mms/be-core/realtime", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  broadcastCollection: mocks.broadcastCollection,
}));

vi.mock("../routes/facultyRouteHelpers.js", () => ({
  auditFaculty: vi.fn().mockResolvedValue(undefined),
}));

import {
  handleDeleteDesignation,
  handleRestoreDesignation,
  handleSaveDesignation,
} from "../routes/facultyDesignationRouteHandlers.js";
import {
  handleRestoreDepartment,
  handleSaveDepartment,
} from "../routes/facultyDepartmentRouteHandlers.js";

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

  it("maps a raw unique violation (23505) to a clean 409 without leaking the PG message", async () => {
    const raw = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "faculty_designations_ws_dept_name_active_uidx"',
      ),
      { code: "23505" },
    );
    mocks.saveFacultyDesignation.mockRejectedValue(raw);
    const { request } = makeRequest();

    const result = await handleSaveDesignation({
      params: { id: "des-1" },
      body: { name: "Mudarris", departmentId: "dept-1" },
      request,
    } as never);

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ type: "conflict" });
    expect((result.body as { message: string }).message).not.toContain("duplicate key");
    expect((result.body as { message: string }).message).not.toContain(
      "violates unique constraint",
    );
  });

  it("recognizes a wrapped unique violation whose code lives on the cause", async () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "x"'), {
      code: "23505",
    });
    const wrapped = new Error("Failed query") as Error & { cause?: unknown };
    wrapped.cause = cause;
    mocks.saveFacultyDepartment.mockRejectedValue(wrapped);
    const { request, log } = makeRequest();

    const result = await handleSaveDepartment({
      params: { id: "dept-1" },
      body: { name: "Hifz" },
      request,
    } as never);

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ type: "conflict" });
    expect(log.error).not.toHaveBeenCalled();
  });

  it("does not infer 404 from a message substring — only a typed statusCode", async () => {
    mocks.saveFacultyDesignation.mockRejectedValue(new Error("designation not found in cache"));
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
});
