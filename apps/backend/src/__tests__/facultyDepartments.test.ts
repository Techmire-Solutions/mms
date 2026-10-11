import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";

const mockListFacultyDepartments = vi.fn();
const mockSaveFacultyDepartment = vi.fn();
const mockFindFacultyDepartmentById = vi.fn();
const mockSoftDeleteFacultyDepartment = vi.fn();
const mockAuditFaculty = vi.fn();

vi.mock("../db/repositories/facultyDepartmentRepository.js", () => ({
  listFacultyDepartments: (...args: unknown[]) => mockListFacultyDepartments(...args),
  saveFacultyDepartment: (...args: unknown[]) => mockSaveFacultyDepartment(...args),
  findFacultyDepartmentById: (...args: unknown[]) => mockFindFacultyDepartmentById(...args),
  softDeleteFacultyDepartment: (...args: unknown[]) => mockSoftDeleteFacultyDepartment(...args),
}));

vi.mock("../db/repositories/facultyCatalogTrashRepository.js", () => ({
  restoreFacultyDepartment: vi.fn(),
}));

vi.mock("../routes/tenant/faculty/facultyRouteHelpers.js", () => ({
  auditFaculty: (...args: unknown[]) => mockAuditFaculty(...args),
}));

import { FacultyCatalogConflictError as FakeConflictError } from "../db/repositories/facultyDepartmentValidation.js";
import {
  handleListDepartments,
  handleSaveDepartment,
  handleDeleteDepartment,
} from "../routes/tenant/faculty/facultyDepartmentRouteHandlers.js";

const readUser: User = {
  id: "usr-1",
  workspaceSubdomain: "demo",
  role: "teacher",
} as unknown as User;
const adminUser: User = {
  id: "usr-admin",
  workspaceSubdomain: "demo",
  role: "admin",
} as unknown as User;
const unauth: User = {
  id: "usr-unauth",
  workspaceSubdomain: "demo",
  role: "guardian",
} as unknown as User;

const savedDepartment = {
  id: "dept-1",
  name: "Quranic Studies",
  description: "Tajweed and Hifz",
  status: "active" as const,
};

describe("facultyDepartmentRouteHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleListDepartments", () => {
    it("given a user without read permission, should return 403", async () => {
      // Act
      const res = await handleListDepartments({
        request: { user: unauth, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(403);
    });

    it("given an authorized user, should return the department read model", async () => {
      // Arrange
      mockListFacultyDepartments.mockResolvedValueOnce([savedDepartment]);

      // Act
      const res = await handleListDepartments({
        request: { user: readUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ departments: [savedDepartment] });
    });
  });

  describe("handleSaveDepartment", () => {
    it("given a user without setupWrite permission, should return 403", async () => {
      // Act
      const res = await handleSaveDepartment({
        params: { id: "dept-1" },
        body: { name: "Hadith", status: "active" },
        request: { user: readUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(403);
      expect(mockSaveFacultyDepartment).not.toHaveBeenCalled();
    });

    it("given name/description/status, should pass the actor to the transactional save and echo the row", async () => {
      // Arrange
      mockSaveFacultyDepartment.mockResolvedValueOnce(savedDepartment);

      // Act
      const res = await handleSaveDepartment({
        params: { id: "dept-1" },
        body: { name: "Quranic Studies", description: "Tajweed and Hifz", status: "active" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ department: savedDepartment });
      expect(mockSaveFacultyDepartment).toHaveBeenCalledWith("demo", {
        id: "dept-1",
        name: "Quranic Studies",
        description: "Tajweed and Hifz",
        status: "active",
        updatedBy: "usr-admin",
      });
      expect(mockAuditFaculty).not.toHaveBeenCalled();
    });

    it("given a duplicate department name, should return 409 conflict", async () => {
      // Arrange
      mockSaveFacultyDepartment.mockRejectedValueOnce(
        new FakeConflictError("A department with this name already exists"),
      );

      // Act
      const res = await handleSaveDepartment({
        params: { id: "dept-2" },
        body: { name: "quranic studies", status: "active" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        type: "conflict",
        message: "A department with this name already exists",
      });
    });

    it("given a repository validation error, should return 400", async () => {
      // Arrange
      mockSaveFacultyDepartment.mockRejectedValueOnce(new Error("Department is archived"));

      // Act
      const res = await handleSaveDepartment({
        params: { id: "dept-1" },
        body: { name: "Hadith", status: "inactive" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ type: "validation_error", message: "Department is archived" });
    });
  });

  describe("handleDeleteDepartment", () => {
    it("given a missing department, should return 404", async () => {
      // Arrange
      mockFindFacultyDepartmentById.mockResolvedValueOnce(null);

      // Act
      const res = await handleDeleteDepartment({
        params: { id: "dept-missing" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(404);
      expect(mockSoftDeleteFacultyDepartment).not.toHaveBeenCalled();
    });

    it("given live designations or assignments reference it, should return 409 conflict", async () => {
      // Arrange
      mockFindFacultyDepartmentById.mockResolvedValueOnce(savedDepartment);
      mockSoftDeleteFacultyDepartment.mockRejectedValueOnce(
        new FakeConflictError("Department has active designations or assignments"),
      );

      // Act
      const res = await handleDeleteDepartment({
        params: { id: "dept-1" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain(
        "active designations or assignments",
      );
    });

    it("given an unreferenced department, should archive it with the actor id", async () => {
      // Arrange
      mockFindFacultyDepartmentById.mockResolvedValueOnce(savedDepartment);
      mockSoftDeleteFacultyDepartment.mockResolvedValueOnce(undefined);

      // Act
      const res = await handleDeleteDepartment({
        params: { id: "dept-1" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(mockSoftDeleteFacultyDepartment).toHaveBeenCalledWith(
        "demo",
        "dept-1",
        "usr-admin",
        "User deleted",
      );
      expect(mockAuditFaculty).not.toHaveBeenCalled();
    });
  });
});
