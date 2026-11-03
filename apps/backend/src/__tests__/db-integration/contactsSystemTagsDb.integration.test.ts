import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  contactTags,
  faculty,
  facultyAssignments,
  facultyDepartments,
  facultyDesignations,
  facultyEmployDesignations,
  facultyEmployments,
  workspaces,
} from "../../db/schema.js";
import { contactUseCases } from "../../contacts/use-cases/contactUseCases.js";
import { studentUseCases } from "../../students/use-cases/studentUseCases.js";
import {
  reconcileContactSystemTags,
  reconcileDesignationContacts,
} from "../../contacts/systemTags/contactSystemTagUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = "contacts-system-tags-regression";
const studentContact = "sys-tag-student";
const fatherContact = "sys-tag-father";
const motherContact = "sys-tag-mother";
const guardianContact = "sys-tag-guardian";
const facultyContact = "sys-tag-faculty";
const departmentId = "sys-tag-dept";
const teacherDesignationId = "sys-tag-teacher";
const principalDesignationId = "sys-tag-principal";
const sameNameContact = "sys-tag-same-name";
const sameNameDepartmentId = "sys-tag-same-name-dept";
const sameNameDepartmentBId = "sys-tag-same-name-dept-b";
const sameNameDesignationA = "sys-tag-coordinator-a";
const sameNameDesignationB = "sys-tag-coordinator-b";

function baseContact(id: string, name: string): Contact {
  return { id, firstName: name, lastName: "Test", name: `${name} Test` } as Contact;
}

async function contact(id: string): Promise<Contact | null> {
  return runWithTenant(tenant, () => contactUseCases.getContactById(id));
}

function tagNames(value: Contact | null): string[] {
  return (value?.tags ?? []).slice().sort();
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "System tag test",
      enabled: true,
    });
    await runWithTenant(tenant, () =>
      Promise.all([
        contactUseCases.upsertContact(baseContact(studentContact, "Student")),
        contactUseCases.upsertContact(baseContact(fatherContact, "Father")),
        contactUseCases.upsertContact(baseContact(motherContact, "Mother")),
        contactUseCases.upsertContact(baseContact(guardianContact, "Guardian")),
        contactUseCases.upsertContact(baseContact(facultyContact, "Faculty")),
        contactUseCases.upsertContact(baseContact(sameNameContact, "Same Name")),
      ]),
    );
    await tx.insert(facultyDepartments).values({
      id: departmentId,
      workspaceSubdomain: tenant,
      name: "Academics",
      status: "active",
      code: "acad",
    });
    await tx.insert(facultyDesignations).values([
      {
        id: teacherDesignationId,
        workspaceSubdomain: tenant,
        departmentId,
        name: "Teacher",
        status: "active",
        code: "teacher",
        hierarchyRank: 1,
      },
      {
        id: principalDesignationId,
        workspaceSubdomain: tenant,
        departmentId,
        name: "Principal",
        status: "active",
        code: "principal",
        hierarchyRank: 1,
      },
    ]);
    await tx.insert(facultyEmployments).values({
      id: "sys-tag-employment",
      workspaceSubdomain: tenant,
      contactId: facultyContact,
      employeeId: "E-SYS-1",
      status: "active",
      employmentStartDate: "2024-01-01",
    });
    await tx.insert(faculty).values({
      id: "sys-tag-faculty-row",
      workspaceSubdomain: tenant,
      employmentId: "sys-tag-employment",
      profileStatus: "active",
    });
    await tx.insert(facultyEmployDesignations).values({
      id: "sys-tag-tenure",
      workspaceSubdomain: tenant,
      employmentId: "sys-tag-employment",
      designationId: teacherDesignationId,
      status: "active",
      startDate: "2024-01-01",
    });
    await tx.insert(facultyAssignments).values({
      id: "sys-tag-assignment",
      workspaceSubdomain: tenant,
      facultyId: "sys-tag-faculty-row",
      departmentId,
      designationId: teacherDesignationId,
      isPrimary: true,
      status: "active",
      startDate: "2024-01-01",
    });

    // Two active designations sharing a display name on a second contact.
    await tx.insert(facultyDepartments).values([
      {
        id: sameNameDepartmentId,
        workspaceSubdomain: tenant,
        name: "Coordination",
        status: "active",
        code: "coord",
      },
      {
        id: sameNameDepartmentBId,
        workspaceSubdomain: tenant,
        name: "Coordination B",
        status: "active",
        code: "coord-b",
      },
    ]);
    await tx.insert(facultyDesignations).values([
      {
        id: sameNameDesignationA,
        workspaceSubdomain: tenant,
        departmentId: sameNameDepartmentId,
        name: "Coordinator",
        status: "active",
        code: "coordinator-a",
        hierarchyRank: 1,
      },
      {
        id: sameNameDesignationB,
        workspaceSubdomain: tenant,
        departmentId: sameNameDepartmentBId,
        name: "Coordinator",
        status: "active",
        code: "coordinator-b",
        hierarchyRank: 1,
      },
    ]);
    await tx.insert(facultyEmployments).values({
      id: "sys-tag-same-name-employment",
      workspaceSubdomain: tenant,
      contactId: sameNameContact,
      employeeId: "E-SYS-2",
      status: "active",
      employmentStartDate: "2024-01-01",
    });
    await tx.insert(faculty).values({
      id: "sys-tag-same-name-faculty",
      workspaceSubdomain: tenant,
      employmentId: "sys-tag-same-name-employment",
      profileStatus: "active",
    });
    await tx.insert(facultyEmployDesignations).values({
      id: "sys-tag-same-name-tenure",
      workspaceSubdomain: tenant,
      employmentId: "sys-tag-same-name-employment",
      designationId: sameNameDesignationA,
      status: "active",
      startDate: "2024-01-01",
    });
    await tx.insert(facultyAssignments).values({
      id: "sys-tag-same-name-assignment",
      workspaceSubdomain: tenant,
      facultyId: "sys-tag-same-name-faculty",
      departmentId: sameNameDepartmentBId,
      designationId: sameNameDesignationB,
      isPrimary: false,
      status: "active",
      startDate: "2024-01-01",
    });
  });
});

afterAll(async () => {
  try {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  } finally {
    await closeDatabase();
  }
});

describe("automatic module role tags (Postgres)", () => {
  it("assigns Student/Parent/Guardian from the student module", async () => {
    await runWithTenant(tenant, () =>
      studentUseCases.createStudent({
        id: "sys-tag-student-row",
        contactId: studentContact,
        status: "active",
      } as never),
    );
    // Guardians live on the student primary contact's relationship graph.
    await runWithTenant(tenant, () =>
      contactUseCases.updateContactById(studentContact, {
        ...baseContact(studentContact, "Student"),
        relationshipContacts: [
          { contactId: fatherContact, name: "Father", relationship: "Parent" },
          { contactId: motherContact, name: "Mother", relationship: "Parent" },
          { contactId: guardianContact, name: "Guardian", relationship: "Guardian" },
        ],
      }),
    );

    expect(tagNames(await contact(studentContact))).toEqual(["Student"]);
    expect(tagNames(await contact(fatherContact))).toEqual(["Parent"]);
    expect(tagNames(await contact(motherContact))).toEqual(["Parent"]);
    expect(tagNames(await contact(guardianContact))).toEqual(["Guardian"]);

    const student = await contact(studentContact);
    expect(student?.systemTags?.[0]).toMatchObject({
      name: "Student",
      source: "student",
      archived: false,
    });
  });

  it("archives student roles on status end and restores them", async () => {
    const fatherBefore = await contact(fatherContact);
    const studentBefore = await contact(studentContact);
    await runWithTenant(tenant, () =>
      studentUseCases.updateStudentById("sys-tag-student-row", { status: "graduated" }),
    );
    expect(tagNames(await contact(studentContact))).toEqual(["Former Student"]);
    expect(tagNames(await contact(fatherContact))).toEqual(["Former Parent"]);
    // Role tags are a projection: they must not rewrite the contact's OCC token or
    // last editor (round-3 N-02).
    const fatherAfter = await contact(fatherContact);
    const studentAfter = await contact(studentContact);
    expect(fatherAfter?.updatedAt).toBe(fatherBefore?.updatedAt);
    expect(fatherAfter?.updatedBy).toBe(fatherBefore?.updatedBy);
    expect(studentAfter?.updatedAt).toBe(studentBefore?.updatedAt);
    expect(studentAfter?.updatedBy).toBe(studentBefore?.updatedBy);

    await runWithTenant(tenant, () =>
      studentUseCases.updateStudentById("sys-tag-student-row", { status: "active" }),
    );
    expect(tagNames(await contact(studentContact))).toEqual(["Student"]);
    expect(tagNames(await contact(fatherContact))).toEqual(["Parent"]);
  });

  it("archives a guardian tag on unlink and restores it on relink", async () => {
    await runWithTenant(tenant, () =>
      contactUseCases.updateContactById(studentContact, {
        ...baseContact(studentContact, "Student"),
        relationshipContacts: [
          { contactId: fatherContact, name: "Father", relationship: "Parent" },
          { contactId: motherContact, name: "Mother", relationship: "Parent" },
        ],
      }),
    );
    expect(tagNames(await contact(guardianContact))).toEqual(["Former Guardian"]);
    expect(tagNames(await contact(fatherContact))).toEqual(["Parent"]);

    await runWithTenant(tenant, () =>
      contactUseCases.updateContactById(studentContact, {
        ...baseContact(studentContact, "Student"),
        relationshipContacts: [
          { contactId: fatherContact, name: "Father", relationship: "Parent" },
          { contactId: motherContact, name: "Mother", relationship: "Parent" },
          { contactId: guardianContact, name: "Guardian", relationship: "Guardian" },
        ],
      }),
    );
    expect(tagNames(await contact(guardianContact))).toEqual(["Guardian"]);
  });

  it("archives a role tag when a bulk save removes the relationship", async () => {
    const bulkStudent = "sys-tag-bulk-student";
    const bulkGuardian = "sys-tag-bulk-guardian";
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(baseContact(bulkStudent, "Bulk Student")),
    );
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(baseContact(bulkGuardian, "Bulk Guardian")),
    );
    await runWithTenant(tenant, () =>
      studentUseCases.createStudent({
        id: "sys-tag-bulk-student-row",
        contactId: bulkStudent,
        status: "active",
      } as never),
    );
    await runWithTenant(tenant, () =>
      contactUseCases.updateContactById(bulkStudent, {
        ...baseContact(bulkStudent, "Bulk Student"),
        relationshipContacts: [
          { contactId: bulkGuardian, name: "Bulk Guardian", relationship: "Guardian" },
        ],
      }),
    );
    expect(tagNames(await contact(bulkGuardian))).toEqual(["Guardian"]);

    // The batch path replaces the child graph, so it must reconcile the target it
    // just unlinked (round-3 N-03).
    await runWithTenant(tenant, () =>
      contactUseCases.bulkSaveContacts([
        {
          ...baseContact(bulkStudent, "Bulk Student"),
          relationshipContacts: [],
        },
      ]),
    );
    expect(tagNames(await contact(bulkGuardian))).toEqual(["Former Guardian"]);
  });

  it("archives student roles on soft-delete and restores them", async () => {
    await runWithTenant(tenant, () =>
      studentUseCases.softDeleteStudentById("sys-tag-student-row", "u-test"),
    );
    expect(tagNames(await contact(studentContact))).toEqual(["Former Student"]);
    expect(tagNames(await contact(fatherContact))).toEqual(["Former Parent"]);

    await runWithTenant(tenant, () =>
      studentUseCases.restoreStudentById("sys-tag-student-row", "u-test"),
    );
    expect(tagNames(await contact(studentContact))).toEqual(["Student"]);
    expect(tagNames(await contact(fatherContact))).toEqual(["Parent"]);
    expect(tagNames(await contact(guardianContact))).toEqual(["Guardian"]);
  });

  it("assigns multi-role faculty tags, converting a colliding manual tag first", async () => {
    // Simulate legacy/manual data inserted before the reconciler ran.
    await withTenant(tenant, async (tx) => {
      await tx.insert(contactTags).values({
        id: "legacy-manual-tag",
        workspaceSubdomain: tenant,
        contactId: facultyContact,
        name: "faculty-teacher",
      });
    });
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [facultyContact]));
    expect(tagNames(await contact(facultyContact))).toEqual(["faculty-Teacher"]);

    await withTenant(tenant, async (tx) => {
      await tx.insert(facultyAssignments).values({
        id: "sys-tag-assignment-2",
        workspaceSubdomain: tenant,
        facultyId: "sys-tag-faculty-row",
        departmentId,
        designationId: principalDesignationId,
        isPrimary: false,
        status: "active",
        startDate: "2024-06-01",
      });
    });
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [facultyContact]));
    expect(tagNames(await contact(facultyContact))).toEqual([
      "faculty-Principal",
      "faculty-Teacher",
    ]);

    await withTenant(tenant, (tx) =>
      tx
        .update(facultyDesignations)
        .set({ name: "Head of Department" })
        .where(eq(facultyDesignations.id, teacherDesignationId)),
    );
    await runWithTenant(tenant, () => reconcileDesignationContacts(tenant, teacherDesignationId));
    expect(tagNames(await contact(facultyContact))).toEqual([
      "faculty-Head of Department",
      "faculty-Principal",
    ]);
  });

  it("archives a faculty role when its assignment ends while another stays active", async () => {
    await withTenant(tenant, async (tx) => {
      await tx
        .update(facultyAssignments)
        .set({ endDate: "2024-12-31" })
        .where(eq(facultyAssignments.id, "sys-tag-assignment-2"));
      await tx
        .update(facultyAssignments)
        .set({ endDate: "2024-12-31" })
        .where(eq(facultyAssignments.id, "sys-tag-assignment"));
    });
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [facultyContact]));
    expect(tagNames(await contact(facultyContact))).toEqual([
      "Former faculty-Principal",
      "faculty-Head of Department",
    ]);
  });

  it("preserves system tags across contact saves and keeps manual tags editable", async () => {
    const before = await withTenant(tenant, (tx) =>
      tx.select().from(contactTags).where(eq(contactTags.contactId, facultyContact)),
    );
    expect(before.filter((row) => row.systemKey?.startsWith("faculty:"))).toHaveLength(2);
    expect(before.filter((row) => row.systemKey === null)).toHaveLength(0);

    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(facultyContact, "Faculty"),
        tags: ["ManualTag"],
      }),
    );
    const saved = await contact(facultyContact);
    expect(tagNames(saved)).toEqual(
      expect.arrayContaining([
        "ManualTag",
        "faculty-Head of Department",
        "Former faculty-Principal",
      ]),
    );
    expect(saved?.systemTags?.length).toBe(2);
  });

  it("archives faculty tags when the faculty profile is deleted and restores them", async () => {
    await withTenant(tenant, (tx) =>
      tx
        .update(faculty)
        .set({ deletedAt: new Date(), deletedBy: "u-test" })
        .where(eq(faculty.id, "sys-tag-faculty-row")),
    );
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [facultyContact]));
    expect(tagNames(await contact(facultyContact))).toEqual(
      expect.arrayContaining(["Former faculty-Head of Department", "Former faculty-Principal"]),
    );

    await withTenant(tenant, (tx) =>
      tx
        .update(faculty)
        .set({ deletedAt: null, deletedBy: null })
        .where(eq(faculty.id, "sys-tag-faculty-row")),
    );
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [facultyContact]));
    expect(tagNames(await contact(facultyContact))).toEqual(
      expect.arrayContaining(["Former faculty-Principal", "faculty-Head of Department"]),
    );
  });

  it("collapses same-name designations and archives on employment dates", async () => {
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact]));
    expect(tagNames(await contact(sameNameContact))).toEqual(["faculty-Coordinator"]);

    // Removing the tag row must not prevent a later designation rename from
    // repairing it: affected contacts come from the role tables, not tag rows.
    await withTenant(tenant, (tx) =>
      tx
        .delete(contactTags)
        .where(
          and(
            eq(contactTags.workspaceSubdomain, tenant),
            eq(contactTags.contactId, sameNameContact),
            eq(contactTags.systemKey, `faculty:designation:${sameNameDesignationA}`),
          ),
        ),
    );
    await withTenant(tenant, (tx) =>
      tx
        .update(facultyDesignations)
        .set({ name: "Lead Coordinator" })
        .where(eq(facultyDesignations.id, sameNameDesignationA)),
    );
    await runWithTenant(tenant, () => reconcileDesignationContacts(tenant, sameNameDesignationA));
    expect(tagNames(await contact(sameNameContact))).toEqual([
      "faculty-Coordinator",
      "faculty-Lead Coordinator",
    ]);

    await withTenant(tenant, (tx) =>
      tx
        .update(facultyDesignations)
        .set({ name: "Senior Coordinator" })
        .where(eq(facultyDesignations.id, sameNameDesignationB)),
    );
    await runWithTenant(tenant, () => reconcileDesignationContacts(tenant, sameNameDesignationB));
    expect(tagNames(await contact(sameNameContact))).toEqual([
      "faculty-Lead Coordinator",
      "faculty-Senior Coordinator",
    ]);

    await withTenant(tenant, (tx) =>
      tx
        .update(facultyEmployments)
        .set({ employmentEndDate: "2024-12-31" })
        .where(eq(facultyEmployments.id, "sys-tag-same-name-employment")),
    );
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact]));
    expect(tagNames(await contact(sameNameContact))).toEqual([
      "Former faculty-Lead Coordinator",
      "Former faculty-Senior Coordinator",
    ]);

    await withTenant(tenant, (tx) =>
      tx
        .update(facultyEmployments)
        .set({ employmentEndDate: null, employmentStartDate: "2099-01-01" })
        .where(eq(facultyEmployments.id, "sys-tag-same-name-employment")),
    );
    await withTenant(tenant, (tx) =>
      tx
        .update(facultyEmployments)
        .set({ employmentStartDate: "2024-01-01", employmentEndDate: null })
        .where(eq(facultyEmployments.id, "sys-tag-same-name-employment")),
    );
    await withTenant(tenant, async (tx) => {
      await tx
        .update(facultyEmployDesignations)
        .set({ startDate: "2099-01-01" })
        .where(eq(facultyEmployDesignations.id, "sys-tag-same-name-tenure"));
      await tx
        .update(facultyAssignments)
        .set({ startDate: "2099-01-01" })
        .where(eq(facultyAssignments.id, "sys-tag-same-name-assignment"));
    });
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact]));
    expect(tagNames(await contact(sameNameContact))).toEqual([
      "Former faculty-Lead Coordinator",
      "Former faculty-Senior Coordinator",
    ]);

    await withTenant(tenant, async (tx) => {
      await tx
        .update(facultyEmployDesignations)
        .set({ startDate: "2024-01-01" })
        .where(eq(facultyEmployDesignations.id, "sys-tag-same-name-tenure"));
      await tx
        .update(facultyAssignments)
        .set({ startDate: "2024-01-01" })
        .where(eq(facultyAssignments.id, "sys-tag-same-name-assignment"));
    });
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact]));
    expect(tagNames(await contact(sameNameContact))).toEqual([
      "faculty-Lead Coordinator",
      "faculty-Senior Coordinator",
    ]);

    // Renaming an archived role updates its Former name too.
    await withTenant(tenant, (tx) =>
      tx
        .update(facultyEmployments)
        .set({ employmentStartDate: "2099-01-01" })
        .where(eq(facultyEmployments.id, "sys-tag-same-name-employment")),
    );
    await runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact]));
    await withTenant(tenant, (tx) =>
      tx
        .update(facultyDesignations)
        .set({ name: "Emeritus Lead" })
        .where(eq(facultyDesignations.id, sameNameDesignationA)),
    );
    await runWithTenant(tenant, () => reconcileDesignationContacts(tenant, sameNameDesignationA));
    expect(tagNames(await contact(sameNameContact))).toEqual([
      "Former faculty-Emeritus Lead",
      "Former faculty-Senior Coordinator",
    ]);
  });

  it("serializes concurrent reconciles for the same contact", async () => {
    await withTenant(tenant, (tx) =>
      tx
        .delete(contactTags)
        .where(
          and(
            eq(contactTags.workspaceSubdomain, tenant),
            eq(contactTags.contactId, sameNameContact),
            sql`${contactTags.systemKey} is not null`,
          ),
        ),
    );

    await Promise.all([
      runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact])),
      runWithTenant(tenant, () => reconcileContactSystemTags(tenant, [sameNameContact])),
    ]);

    const rows = await withTenant(tenant, (tx) =>
      tx.select().from(contactTags).where(eq(contactTags.contactId, sameNameContact)),
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.systemKey)).size).toBe(2);
  });
});
