import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";

const mockFindFacultyAssignmentById = vi.fn();
const mockListFacultyAssignments = vi.fn();
const mockSaveFacultyAssignment = vi.fn();
const mockCloseAssignment = vi.fn();
const mockSoftDeleteFacultyAssignment = vi.fn();
const mockCheckAssignmentCycleSafe = vi.fn();
const mockFindAssignmentSubordinateTree = vi.fn();
const mockFindAssignmentManagerChain = vi.fn();
const mockAuditFaculty = vi.fn();

vi.mock("../db/repositories/facultyAssignmentRepository.js", () => ({
  findFacultyAssignmentById: (...args: unknown[]) => mockFindFacultyAssignmentById(...args),
  listFacultyAssignments: (...args: unknown[]) => mockListFacultyAssignments(...args),
  saveFacultyAssignment: (...args: unknown[]) => mockSaveFacultyAssignment(...args),
  closeAssignment: (...args: unknown[]) => mockCloseAssignment(...args),
  softDeleteFacultyAssignment: (...args: unknown[]) => mockSoftDeleteFacultyAssignment(...args),
}));

vi.mock("../db/repositories/facultyAssignmentHierarchyRepository.js", () => ({
  checkAssignmentCycleSafe: (...args: unknown[]) => mockCheckAssignmentCycleSafe(...args),
  findAssignmentSubordinateTree: (...args: unknown[]) => mockFindAssignmentSubordinateTree(...args),
  findAssignmentManagerChain: (...args: unknown[]) => mockFindAssignmentManagerChain(...args),
}));

vi.mock("../routes/tenant/faculty/facultyRouteHelpers.js", () => ({
  auditFaculty: (...args: unknown[]) => mockAuditFaculty(...args),
}));

import {
  handleListAssignments,
  handleSaveAssignment,
  handleCloseAssignment,
  handleDeleteAssignment,
  handleGetSubordinates,
  handleGetManagers,
} from "../routes/tenant/faculty/facultyAssignmentRouteHandlers.js";

const readUser = { id: "usr-1", workspaceSubdomain: "demo", role: "teacher" } as unknown as User;
const adminUser = { id: "usr-admin", workspaceSubdomain: "demo", role: "admin" } as unknown as User;
const unauthUser = {
  id: "usr-unauth",
  workspaceSubdomain: "demo",
  role: "guardian",
} as unknown as User;

describe("facultyAssignmentRouteHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleListAssignments", () => {
    it("returns 403 when user lacks read permission", async () => {
      const res = await handleListAssignments({
        params: { facultyId: "fac-1" },
        request: { user: unauthUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(403);
    });

    it("returns 200 with serialized assignments for authorized user", async () => {
      mockListFacultyAssignments.mockResolvedValueOnce([
        {
          id: "asgn-1",
          facultyId: "fac-1",
          departmentId: "dept-1",
          designationId: "des-1",
          notes: "Primary role",
          deletedAt: null,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ]);
      const res = await handleListAssignments({
        params: { facultyId: "fac-1" },
        query: { activeOnly: true },
        request: { user: readUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(200);
      expect((res.body as { assignments: unknown[] }).assignments).toHaveLength(1);
    });
  });

  describe("handleSaveAssignment", () => {
    it("returns 403 when user lacks write permission", async () => {
      const res = await handleSaveAssignment({
        params: { facultyId: "fac-1", id: "asgn-1" },
        body: {
          departmentId: "d1",
          designationId: "des1",
          startDate: "2024-01-01",
          isPrimary: true,
        },
        request: { user: unauthUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(403);
    });

    it("passes the actor to the transactional repository on valid save", async () => {
      const savedRow = {
        id: "asgn-new",
        facultyId: "fac-1",
        departmentId: "d1",
        designationId: "des1",
        endDate: null,
        notes: null,
        deletedAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };
      mockFindFacultyAssignmentById.mockResolvedValueOnce(savedRow);
      const res = await handleSaveAssignment({
        params: { facultyId: "fac-1", id: "asgn-new" },
        body: {
          departmentId: "d1",
          designationId: "des1",
          startDate: "2024-01-01",
          isPrimary: true,
        },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(200);
      expect(mockSaveFacultyAssignment).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ updatedBy: "usr-admin" }),
      );
      expect(mockAuditFaculty).not.toHaveBeenCalled();
    });
  });

  describe("handleCloseAssignment", () => {
    it("returns 404 when assignment does not exist", async () => {
      mockFindFacultyAssignmentById.mockResolvedValueOnce(null);
      const res = await handleCloseAssignment({
        params: { facultyId: "fac-1", id: "asgn-1" },
        body: { endDate: "2025-01-01" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(404);
    });

    it("returns 400 when end date precedes start date", async () => {
      mockFindFacultyAssignmentById.mockResolvedValueOnce({
        id: "asgn-1",
        facultyId: "fac-1",
        startDate: "2025-06-01",
      });
      const res = await handleCloseAssignment({
        params: { facultyId: "fac-1", id: "asgn-1" },
        body: { endDate: "2025-01-01" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(400);
    });

    it("returns 200 on successful close", async () => {
      mockFindFacultyAssignmentById.mockResolvedValueOnce({
        id: "asgn-1",
        facultyId: "fac-1",
        startDate: "2024-01-01",
      });
      const res = await handleCloseAssignment({
        params: { facultyId: "fac-1", id: "asgn-1" },
        body: { endDate: "2025-01-01" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(200);
      expect(mockCloseAssignment).toHaveBeenCalledWith("demo", "asgn-1", "2025-01-01", "usr-admin");
    });
  });

  describe("handleDeleteAssignment", () => {
    it("returns 200 and soft-deletes assignment", async () => {
      mockFindFacultyAssignmentById.mockResolvedValueOnce({ id: "asgn-1", facultyId: "fac-1" });
      const res = await handleDeleteAssignment({
        params: { facultyId: "fac-1", id: "asgn-1" },
        request: { user: adminUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(200);
      expect(mockSoftDeleteFacultyAssignment).toHaveBeenCalledWith(
        "demo",
        "asgn-1",
        "usr-admin",
        "User deleted",
      );
    });
  });

  describe("hierarchy endpoints", () => {
    it("returns subordinate tree for authorized user", async () => {
      mockFindFacultyAssignmentById.mockResolvedValueOnce({ id: "asgn-1" });
      mockFindAssignmentSubordinateTree.mockResolvedValueOnce([{ id: "asgn-sub-1", depth: 1 }]);
      const res = await handleGetSubordinates({
        params: { id: "asgn-1" },
        request: { user: readUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(200);
      expect((res.body as { tree: unknown[] }).tree).toHaveLength(1);
    });

    it("returns manager chain for authorized user", async () => {
      mockFindFacultyAssignmentById.mockResolvedValueOnce({ id: "asgn-1" });
      mockFindAssignmentManagerChain.mockResolvedValueOnce([{ id: "asgn-mgr-1", depth: 1 }]);
      const res = await handleGetManagers({
        params: { id: "asgn-1" },
        request: { user: readUser, tenant: { id: "demo" } },
      } as never);
      expect(res.status).toBe(200);
      expect((res.body as { chain: unknown[] }).chain).toHaveLength(1);
    });
  });
});
