import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "@mms/shared";
import {
  resolveStudentAccessScope,
  isStudentInAssignedSections,
} from "../students/repository/studentScopingRepository.js";
import { buildListConditions } from "../db/repositories/studentRepositoryListQuery.js";
import { resolveUserStudentClearance } from "../routes/tenant/students/studentRouteHelpers.js";
import { sanitizeStudentForViewer, maskNationalId } from "@mms/shared";

// Mock the tenant-context instance
const mockSelect = vi.fn();
const fakeTx = { select: mockSelect };

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: vi.fn(async (_tenant: string, work: (tx: any) => Promise<any>) => work(fakeTx)),
}));

function renderSql(query: unknown): string {
  if (!query) return "";
  if (typeof query === "string") return query;
  if (query instanceof String) return String(query);
  if (typeof query === "object") {
    const symName = (query as any)[Symbol.for("drizzle:Name")];
    if (typeof symName === "string") return symName;

    if ("queryChunks" in query && Array.isArray((query as any).queryChunks)) {
      return (query as any).queryChunks.map(renderSql).join("");
    }
    if ("value" in query) {
      const val = (query as any).value;
      if (val !== undefined && val !== null) {
        if (typeof val === "object" && "queryChunks" in val) {
          return renderSql(val);
        }
        return String(val);
      }
    }
    if ("name" in query && (query as any).name) {
      return `"${(query as any).name}"`;
    }
    if ("table" in query && (query as any).table) {
      const tbl = (query as any).table;
      return (tbl as any)[Symbol.for("drizzle:Name")] ?? (tbl as any).name ?? "?";
    }
  }
  return String(query);
}

describe("Student Security, Scoping & Privacy", () => {
  const testSubdomain = "campus-alpha";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveStudentAccessScope", () => {
    it("grants unrestricted directory access to admin, principal, and registrar", async () => {
      const adminUser: User = {
        id: "u-1",
        email: "admin@test.com",
        name: "Admin User",
        role: "admin",
        workspaceSubdomain: testSubdomain,
      };
      const principalUser: User = {
        id: "u-2",
        email: "principal@test.com",
        name: "Principal User",
        role: "principal",
        workspaceSubdomain: testSubdomain,
      };
      const registrarUser: User = {
        id: "u-3",
        email: "reg@test.com",
        name: "Registrar User",
        role: "registrar",
        workspaceSubdomain: testSubdomain,
      };

      expect(await resolveStudentAccessScope(testSubdomain, adminUser)).toEqual({
        isUnrestricted: true,
        assignedSectionIds: [],
      });
      expect(await resolveStudentAccessScope(testSubdomain, principalUser)).toEqual({
        isUnrestricted: true,
        assignedSectionIds: [],
      });
      expect(await resolveStudentAccessScope(testSubdomain, registrarUser)).toEqual({
        isUnrestricted: true,
        assignedSectionIds: [],
      });
    });

    it("restricts teachers without faculty records to empty section scope", async () => {
      const teacherUser: User = {
        id: "u-teacher-1",
        email: "teacher@test.com",
        name: "Teacher One",
        role: "teacher",
        workspaceSubdomain: testSubdomain,
      };

      // Mock DB: no faculty profile found
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      } as any);

      const scope = await resolveStudentAccessScope(testSubdomain, teacherUser);
      expect(scope).toEqual({
        isUnrestricted: false,
        assignedSectionIds: [],
      });
    });

    it("resolves active section assignments for assigned teachers", async () => {
      const teacherUser: User = {
        id: "u-teacher-2",
        email: "teacher2@test.com",
        name: "Teacher Two",
        role: "teacher",
        workspaceSubdomain: testSubdomain,
      };

      // Mock 1: faculty record found with id 'fac-101'
      mockSelect
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: "fac-101" }]),
            }),
          }),
        } as any)
        // Mock 2: active section assignments
        .mockReturnValueOnce({
          from: () => ({
            where: () =>
              Promise.resolve([{ sectionId: "sec-grade10-a" }, { sectionId: "sec-grade10-b" }]),
          }),
        } as any);

      const scope = await resolveStudentAccessScope(testSubdomain, teacherUser);
      expect(scope).toEqual({
        isUnrestricted: false,
        assignedSectionIds: ["sec-grade10-a", "sec-grade10-b"],
      });
    });
  });

  describe("isStudentInAssignedSections", () => {
    it("returns false immediately when teacher has no assigned sections", async () => {
      const allowed = await isStudentInAssignedSections(testSubdomain, "s-1", []);
      expect(allowed).toBe(false);
    });

    it("returns true when student is enrolled in one of the teacher sections", async () => {
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "enr-1" }]),
          }),
        }),
      } as any);

      const allowed = await isStudentInAssignedSections(testSubdomain, "s-1", ["sec-10a"]);
      expect(allowed).toBe(true);
    });

    it("returns false when student is NOT enrolled in any assigned section", async () => {
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      } as any);

      const allowed = await isStudentInAssignedSections(testSubdomain, "s-2", ["sec-10a"]);
      expect(allowed).toBe(false);
    });
  });

  describe("buildListConditions - Multi-Tenancy & Teacher Scoping", () => {
    it("injects 1 = 0 when teacher has an empty section scope", () => {
      const conditions = buildListConditions(testSubdomain, {
        scopedSectionIds: [],
      });
      const sqlStrings = conditions.map(renderSql);
      expect(sqlStrings.some((s) => s.includes("1 = 0"))).toBe(true);
    });

    it("injects section IN condition when scopedSectionIds are provided", () => {
      const conditions = buildListConditions(testSubdomain, {
        scopedSectionIds: ["sec-alpha", "sec-beta"],
      });
      const sqlStrings = conditions.map(renderSql);
      const enrollmentScope = sqlStrings.find((s) => s.includes("section_id"));
      expect(enrollmentScope).toBeDefined();
      expect(enrollmentScope).toContain("sec-alpha");
      expect(enrollmentScope).toContain("sec-beta");
    });

    it("binds tenant subdomain explicitly to search queries and subqueries", () => {
      const conditions = buildListConditions(testSubdomain, {
        search: "Ahmed",
      });
      const sqlStrings = conditions.map(renderSql);
      const searchSql = sqlStrings.find((s) => s.includes("contact_phones"));
      expect(searchSql).toBeDefined();
      // Verifies workspace_subdomain binding exists in correlated subquery
      expect(searchSql).toContain("workspace_subdomain");
    });
  });

  describe("PII & Sensitive Field Redaction", () => {
    it("masks national ID/CNIC for standard viewers", () => {
      expect(maskNationalId("35202-1234567-9")).toBe("***-**-67-9");
      expect(maskNationalId("123")).toBe("****");
      expect(maskNationalId("")).toBeUndefined();
    });

    it("resolves granular clearance by institutional role", () => {
      const principalUser: User = {
        id: "u-p",
        email: "p@school.edu",
        name: "Principal",
        role: "principal",
        workspaceSubdomain: testSubdomain,
      };
      const teacherUser: User = {
        id: "u-t",
        email: "t@school.edu",
        name: "Teacher",
        role: "teacher",
        workspaceSubdomain: testSubdomain,
      };

      const principalClearance = resolveUserStudentClearance(principalUser);
      expect(principalClearance.canViewNotes).toBe(true);
      expect(principalClearance.canViewMedical).toBe(true);
      expect(principalClearance.canViewIep).toBe(true);
      expect(principalClearance.canViewSensitivePii).toBe(true);

      const teacherClearance = resolveUserStudentClearance(teacherUser);
      expect(teacherClearance.canViewNotes).toBe(true);
      expect(teacherClearance.canViewMedical).toBe(false);
      expect(teacherClearance.canViewIep).toBe(false);
      expect(teacherClearance.canViewSensitivePii).toBe(false);
    });

    it("sanitizes student profile for teacher, masking CNIC and converting medical conditions to alert flag", () => {
      const studentRecord: any = {
        id: "st-1",
        contactId: "c-1",
        name: "Fatima Noor",
        cnic: "35202-9876543-2",
        notes: "Classroom behavior notes",
        medicalConditions: ["Severe Nut Allergy"],
        customFields: {
          cnic: "35202-9876543-2",
          psychologicalEvaluation: "Restricted child psychologist report",
          favoriteSubject: "Science",
        },
      };

      const sanitized = sanitizeStudentForViewer(
        studentRecord,
        "teacher",
        { fields: {}, tabs: [] },
        {
          canViewNotes: true,
          canViewMedical: false,
          canViewIep: false,
          canViewSensitivePii: false,
        },
      );

      // Identity & Notes
      expect(sanitized.id).toBe("st-1");
      expect(sanitized.name).toBe("Fatima Noor");
      expect(sanitized.notes).toBe("Classroom behavior notes");

      // CNIC masked
      expect(sanitized.cnic).toBe("***-**-43-2");
      const cFields = sanitized.customFields as Record<string, unknown>;
      expect(cFields.cnic).toBe("***-**-43-2");

      // Medical details redacted and converted to boolean alert
      expect(sanitized.medicalConditions).toBeUndefined();
      expect(sanitized.hasMedicalAlert).toBe(true);

      // Psychological evaluation stripped, general custom field preserved
      expect(cFields.psychologicalEvaluation).toBeUndefined();
      expect(cFields.favoriteSubject).toBe("Science");
    });
  });
});
