import { and, eq, inArray } from "drizzle-orm";
import { sessionClassTimetablePeriods, scholarshipEligibilities } from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { periodSubjectSql } from "./academicCatalogNameSql.js";

type Transaction = TenantTransaction;

export async function loadTimetablePeriodsAndEligibilities(
  tx: Transaction,
  subdomain: string,
  timetableIds: string[],
  eligibilityIds: string[],
) {
  return Promise.all([
    timetableIds.length > 0
      ? tx
          .select({
            id: sessionClassTimetablePeriods.id,
            workspaceSubdomain: sessionClassTimetablePeriods.workspaceSubdomain,
            timetableId: sessionClassTimetablePeriods.timetableId,
            startTime: sessionClassTimetablePeriods.startTime,
            endTime: sessionClassTimetablePeriods.endTime,
            subject: periodSubjectSql,
            subjectId: sessionClassTimetablePeriods.subjectId,
            facultyId: sessionClassTimetablePeriods.facultyId,
            facultyName: sessionClassTimetablePeriods.facultyName,
            createdAt: sessionClassTimetablePeriods.createdAt,
          })
          .from(sessionClassTimetablePeriods)
          .where(
            and(
              eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain),
              inArray(sessionClassTimetablePeriods.timetableId, timetableIds),
            ),
          )
      : Promise.resolve([]),
    eligibilityIds.length > 0
      ? tx
          .select({
            id: scholarshipEligibilities.id,
            workspaceSubdomain: scholarshipEligibilities.workspaceSubdomain,
            orphan: scholarshipEligibilities.orphan,
            job: scholarshipEligibilities.job,
            business: scholarshipEligibilities.business,
            property: scholarshipEligibilities.property,
            familyMembers: scholarshipEligibilities.familyMembers,
            onJobMembers: scholarshipEligibilities.onJobMembers,
            schoolGoingSiblings: scholarshipEligibilities.schoolGoingSiblings,
            residence: scholarshipEligibilities.residence,
            notes: scholarshipEligibilities.notes,
            createdAt: scholarshipEligibilities.createdAt,
          })
          .from(scholarshipEligibilities)
          .where(
            and(
              eq(scholarshipEligibilities.workspaceSubdomain, subdomain),
              inArray(scholarshipEligibilities.id, eligibilityIds),
            ),
          )
      : Promise.resolve([]),
  ]);
}
