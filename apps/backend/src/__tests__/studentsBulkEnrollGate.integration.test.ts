/**
 * Fastify inject coverage for the Students bulk-enroll cross-module gate.
 *
 * The enrollment mutation is an enrollments-module operation: it must require
 * `enrollments.write` and enrollments enablement even though the route lives on
 * the students surface (module access gates are enforced server-side, never by
 * frontend visibility).
 */
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentOperationRoutes } from "../routes/tenant/students/studentOperationRoutes.js";

const { canWriteCollection, getModuleAccessDenial, bulkEnrollStudents, bulkUpdateStudentStatus } =
  vi.hoisted(() => ({
    canWriteCollection: vi.fn(),
    getModuleAccessDenial: vi.fn(),
    bulkEnrollStudents: vi.fn(),
    bulkUpdateStudentStatus: vi.fn(),
  }));

vi.mock("../services/rbacService.js", () => ({
  canWriteCollection: (...args: unknown[]) => canWriteCollection(...args),
  canReadCollection: vi.fn(),
}));
vi.mock("../middleware/requireTenantModule.js", () => ({
  getModuleAccessDenial: (...args: unknown[]) => getModuleAccessDenial(...args),
}));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, work: () => Promise<unknown>) => work(),
}));
vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));
vi.mock("../students/use-cases/studentUseCases.js", () => ({
  studentUseCases: {
    bulkEnrollStudents: (...args: unknown[]) => bulkEnrollStudents(...args),
    bulkUpdateStudentStatus: (...args: unknown[]) => bulkUpdateStudentStatus(...args),
  },
}));
vi.mock("../routes/tenant/students/studentRouteHelpers.js", () => ({
  auditStudent: vi.fn(),
}));

const ENROLL_BODY = {
  studentIds: ["s1"],
  sessionId: "sess-1",
  classId: "cls-1",
  mode: "add",
};

async function buildApp() {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.user = {
      id: "u-actor",
      name: "Actor",
      email: "actor@example.test",
      role: "registrar",
      workspaceSubdomain: "demo",
    };
    request.tenant = { id: "demo" };
  });
  await app.register(studentOperationRoutes);
  return app;
}

describe("Students bulk-enroll enrollment gate (inject)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModuleAccessDenial.mockResolvedValue(null);
    bulkEnrollStudents.mockResolvedValue({ succeeded: 1, failed: 0 });
  });

  it("denies bulk-enroll when the caller lacks enrollments.write", async () => {
    canWriteCollection.mockImplementation(
      (_user: unknown, collection: string) => collection === "students",
    );

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/students/bulk-enroll",
        headers: { host: "demo.localhost" },
        payload: ENROLL_BODY,
      });
      expect(response.statusCode).toBe(403);
      expect(bulkEnrollStudents).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("denies bulk-enroll when the enrollments module is unavailable", async () => {
    canWriteCollection.mockResolvedValue(true);
    getModuleAccessDenial.mockResolvedValue({
      type: "forbidden",
      code: "MODULE_DISABLED",
      moduleId: "enrollment",
      message: "The enrollment module is disabled for this workspace.",
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/students/bulk-enroll",
        headers: { host: "demo.localhost" },
        payload: ENROLL_BODY,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "MODULE_DISABLED", moduleId: "enrollment" });
      expect(bulkEnrollStudents).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("allows bulk-enroll when both module permissions are held", async () => {
    canWriteCollection.mockResolvedValue(true);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/students/bulk-enroll",
        headers: { host: "demo.localhost" },
        payload: ENROLL_BODY,
      });
      expect(response.statusCode).toBe(200);
      expect(bulkEnrollStudents).toHaveBeenCalledWith(
        expect.objectContaining({ studentIds: ["s1"], sessionId: "sess-1", mode: "add" }),
      );
    } finally {
      await app.close();
    }
  });

  it("keeps status changes independent of the enrollment gate (lifecycle cascade)", async () => {
    canWriteCollection.mockImplementation(
      (_user: unknown, collection: string) => collection === "students",
    );
    bulkUpdateStudentStatus.mockResolvedValue({ succeeded: 1, failed: 0 });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/students/bulk-status",
        headers: { host: "demo.localhost" },
        payload: { ids: ["s1"], status: "graduated" },
      });
      expect(response.statusCode).toBe(200);
      expect(bulkUpdateStudentStatus).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
