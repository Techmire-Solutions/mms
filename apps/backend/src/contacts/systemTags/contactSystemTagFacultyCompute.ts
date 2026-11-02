import { and, eq, inArray } from "drizzle-orm";
import {
  CONTACT_SYSTEM_TAG_KEYS,
  CONTACT_TAG_SOURCE_FACULTY,
  formatFacultySystemTag,
} from "@mms/shared";
import {
  faculty,
  facultyAssignments,
  facultyDesignations,
  facultyEmployDesignations,
  facultyEmployments,
} from "../../db/schema.js";
import type { TenantTransaction } from "../../db/tenant-context.js";
import {
  ACTIVE_EMPLOYMENT_STATUSES,
  addDesired,
  isActiveWindow,
  type DesiredSystemTag,
} from "./contactSystemTagCompute.js";

/** Faculty module roles: every designation from HR tenure and multi-role assignments. */
interface FacultyRoleRow {
  contactId: string;
  employmentStatus: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  employmentDeletedAt: Date | null;
  facultyDeletedAt: Date | null;
  designationId: string;
  designationName: string;
  designationStatus: string | null;
  designationDeletedAt: Date | null;
  sourceStatus: string | null;
  sourceStartDate: string | null;
  sourceEndDate: string | null;
  sourceDeletedAt: Date | null;
}

export async function computeFacultyDesiredTags(
  tx: TenantTransaction,
  subdomain: string,
  contactIds: string[],
  today: string,
): Promise<Map<string, Map<string, DesiredSystemTag>>> {
  const tenureRows = (await tx
    .select({
      contactId: facultyEmployments.contactId,
      employmentStatus: facultyEmployments.status,
      employmentStartDate: facultyEmployments.employmentStartDate,
      employmentEndDate: facultyEmployments.employmentEndDate,
      employmentDeletedAt: facultyEmployments.deletedAt,
      facultyDeletedAt: faculty.deletedAt,
      designationId: facultyDesignations.id,
      designationName: facultyDesignations.name,
      designationStatus: facultyDesignations.status,
      designationDeletedAt: facultyDesignations.deletedAt,
      sourceStatus: facultyEmployDesignations.status,
      sourceStartDate: facultyEmployDesignations.startDate,
      sourceEndDate: facultyEmployDesignations.endDate,
      sourceDeletedAt: facultyEmployDesignations.deletedAt,
    })
    .from(facultyEmployments)
    .innerJoin(
      faculty,
      and(
        eq(faculty.workspaceSubdomain, subdomain),
        eq(faculty.employmentId, facultyEmployments.id),
      ),
    )
    .innerJoin(
      facultyEmployDesignations,
      and(
        eq(facultyEmployDesignations.workspaceSubdomain, subdomain),
        eq(facultyEmployDesignations.employmentId, facultyEmployments.id),
      ),
    )
    .innerJoin(
      facultyDesignations,
      and(
        eq(facultyDesignations.workspaceSubdomain, subdomain),
        eq(facultyDesignations.id, facultyEmployDesignations.designationId),
      ),
    )
    .where(
      and(
        eq(facultyEmployments.workspaceSubdomain, subdomain),
        inArray(facultyEmployments.contactId, contactIds),
      ),
    )) as unknown as FacultyRoleRow[];

  const assignmentRows = (await tx
    .select({
      contactId: facultyEmployments.contactId,
      employmentStatus: facultyEmployments.status,
      employmentStartDate: facultyEmployments.employmentStartDate,
      employmentEndDate: facultyEmployments.employmentEndDate,
      employmentDeletedAt: facultyEmployments.deletedAt,
      facultyDeletedAt: faculty.deletedAt,
      designationId: facultyDesignations.id,
      designationName: facultyDesignations.name,
      designationStatus: facultyDesignations.status,
      designationDeletedAt: facultyDesignations.deletedAt,
      sourceStatus: facultyAssignments.status,
      sourceStartDate: facultyAssignments.startDate,
      sourceEndDate: facultyAssignments.endDate,
      sourceDeletedAt: facultyAssignments.deletedAt,
    })
    .from(facultyEmployments)
    .innerJoin(
      faculty,
      and(
        eq(faculty.workspaceSubdomain, subdomain),
        eq(faculty.employmentId, facultyEmployments.id),
      ),
    )
    .innerJoin(
      facultyAssignments,
      and(
        eq(facultyAssignments.workspaceSubdomain, subdomain),
        eq(facultyAssignments.facultyId, faculty.id),
      ),
    )
    .innerJoin(
      facultyDesignations,
      and(
        eq(facultyDesignations.workspaceSubdomain, subdomain),
        eq(facultyDesignations.id, facultyAssignments.designationId),
      ),
    )
    .where(
      and(
        eq(facultyEmployments.workspaceSubdomain, subdomain),
        inArray(facultyEmployments.contactId, contactIds),
      ),
    )) as unknown as FacultyRoleRow[];

  const perContact = new Map<string, Map<string, DesiredSystemTag>>();
  for (const row of [...tenureRows, ...assignmentRows]) {
    const active =
      row.employmentDeletedAt == null &&
      ACTIVE_EMPLOYMENT_STATUSES.has(row.employmentStatus ?? "") &&
      isActiveWindow(row.employmentStartDate, row.employmentEndDate, today) &&
      row.facultyDeletedAt == null &&
      row.designationDeletedAt == null &&
      row.designationStatus === "active" &&
      row.sourceDeletedAt == null &&
      row.sourceStatus === "active" &&
      isActiveWindow(row.sourceStartDate, row.sourceEndDate, today);
    const key = CONTACT_SYSTEM_TAG_KEYS.facultyDesignation(String(row.designationId));
    const tags = perContact.get(String(row.contactId)) ?? new Map<string, DesiredSystemTag>();
    addDesired(
      tags,
      {
        name: formatFacultySystemTag(String(row.designationName)),
        source: CONTACT_TAG_SOURCE_FACULTY,
        systemKey: key,
        archived: false,
      },
      !active,
    );
    perContact.set(String(row.contactId), tags);
  }
  return perContact;
}
