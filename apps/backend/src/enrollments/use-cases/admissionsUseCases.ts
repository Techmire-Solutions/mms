import {
  evaluateEligibility,
  registrationApplicationListQuerySchema,
  registrationReviewSchema,
  type AdmissionsMetrics,
  type RegistrationApplication,
  type RegistrationApplicationListQuery,
  type RegistrationApplicationStatus,
  type RegistrationReview,
  type User,
} from "@mms/shared";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import type { ApplicationJoinedRow } from "../repository/admissionsRepository.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { approveApplications, type ApproveOutcome } from "./admissionsApprove.js";
import { ADMISSIONS_BROADCAST_KEY } from "./registrationPublicUseCases.js";

const NON_APPROVE_STATUS: Record<
  "reject" | "waitlist" | "under_review",
  RegistrationApplicationStatus
> = {
  reject: "rejected",
  waitlist: "waitlisted",
  under_review: "under_review",
};

function toApplication(
  row: ApplicationJoinedRow,
  today: string,
  matchedStudentId: string | null,
): RegistrationApplication {
  // Rules may change after submission, so reviewers see eligibility against the class as it is now.
  const eligibility = evaluateEligibility({
    applicant: { dateOfBirth: row.dateOfBirth, gender: row.gender },
    cls: {
      gender: row.classGender,
      minAge: row.classMinAge,
      maxAge: row.classMaxAge,
      ageCalculationDate: row.classAgeCalcDate,
    },
    session: { status: row.sessionStatus, startDate: row.sessionStartDate },
    asOf: today,
  });
  return {
    id: row.id,
    reference: row.reference,
    linkId: row.linkId,
    sessionId: row.sessionId,
    sessionName: row.sessionName,
    classId: row.classId,
    className: row.className,
    preferredSectionId: row.preferredSectionId,
    fullName: row.fullName,
    guardianName: row.guardianName,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    address: row.address,
    previousMadrasa: row.previousMadrasa,
    status: row.status as RegistrationApplicationStatus,
    eligibilityReasons: eligibility.reasons,
    matchedStudentId: row.studentId ? null : matchedStudentId,
    studentId: row.studentId,
    enrollmentId: row.enrollmentId,
    reviewReason: row.reviewReason,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createAdmissionsUseCases() {
  return {
    async list(tenant: string, rawQuery: RegistrationApplicationListQuery) {
      const query = registrationApplicationListQuerySchema.parse(rawQuery);
      const subdomain = tenant.trim().toLowerCase();
      const today = todayInTimeZone(await repo.findWorkspaceTimezone(subdomain));
      return withTenantRead(subdomain, async (tx) => {
        const { rows, total } = await repo.listApplicationsTx(tx, subdomain, query);
        const matches = await repo.findMatchingStudentIdsTx(
          tx,
          subdomain,
          rows.filter((row) => !row.studentId),
        );
        return {
          items: rows.map((row) => toApplication(row, today, matches.get(row.id) ?? null)),
          total,
          page: query.page,
          limit: query.limit,
        };
      });
    },

    metrics(tenant: string, sessionId?: string): Promise<AdmissionsMetrics> {
      const subdomain = tenant.trim().toLowerCase();
      return withTenantRead(subdomain, (tx) => repo.admissionsMetricsTx(tx, subdomain, sessionId));
    },

    async review(tenant: string, body: RegistrationReview, user: User): Promise<ApproveOutcome> {
      const input = registrationReviewSchema.parse(body);
      const subdomain = tenant.trim().toLowerCase();
      let outcome: ApproveOutcome;
      if (input.decision === "approve") {
        outcome = await approveApplications(subdomain, input.ids, {
          actorUserId: String(user.id),
          user,
          sectionId: input.sectionId,
          existingStudentId: input.existingStudentId,
        });
      } else {
        const status = NON_APPROVE_STATUS[input.decision];
        outcome = await withTenant(subdomain, async (tx) => {
          const apps = await repo.findApplicationsByIdsTx(tx, subdomain, input.ids);
          const result: ApproveOutcome = { updated: 0, failures: [] };
          for (const app of apps) {
            if (app.status === "approved") {
              result.failures.push({
                id: app.id,
                message: "Approved applications cannot be changed; withdraw the enrollment instead",
              });
              continue;
            }
            await repo.updateApplicationTx(tx, subdomain, app.id, {
              status,
              reviewReason: input.reason,
              reviewedBy: String(user.id),
            });
            await recordModernAuditEvent(tx, {
              workspaceSubdomain: subdomain,
              tableName: "registration_applications",
              recordId: app.id,
              actionType: "UPDATE",
              realUserId: String(user.id),
              newState: { status, reason: input.reason },
            });
            result.updated += 1;
          }
          for (const id of input.ids)
            if (!apps.some((app) => app.id === id))
              result.failures.push({ id, message: "Application not found" });
          return result;
        });
      }
      broadcastTenantUpdate(subdomain, "collection", ADMISSIONS_BROADCAST_KEY);
      return outcome;
    },
  };
}

export const admissionsUseCases = createAdmissionsUseCases();
