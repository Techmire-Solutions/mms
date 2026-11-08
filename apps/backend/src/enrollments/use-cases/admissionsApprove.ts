import { randomUUID } from "node:crypto";
import type { Contact, User } from "@mms/shared";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import type { ApplicationJoinedRow } from "../repository/admissionsRepository.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { upsertContact } from "../../contacts/use-cases/contactWriteUseCases.js";
import { createGuardianContact, guardianRelationships } from "./admissionsGuardianLink.js";
import { createStudent } from "../../students/use-cases/studentWriteUseCases.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { canTransitionApplication } from "@mms/shared";
import { bulkEnrollStudentsIntoClass } from "./enrollmentBulkEnroll.js";

export interface ApproveOptions {
  /** Reviewer; null for auto-approval of links that skip review. */
  actorUserId: string | null;
  user?: User;
  sectionId?: string | null;
  existingStudentId?: string | null;
}

export interface ApproveOutcome {
  updated: number;
  failures: Array<{ id: string; message: string }>;
}

/**
 * Creates the applicant's contact and student (Contacts own the person identity), plus the
 * guardian contact the application names. The guardian is linked both as a relationship on the
 * student's contact and through `students.guardian_contact_id`; a guardian that could not be
 * given a contact falls back to the `guardian_name` text column, so the name is never dropped.
 */
async function createStudentFromApplication(
  app: ApplicationJoinedRow,
  today: string,
  user: User | undefined,
): Promise<string> {
  const [firstName, ...rest] = app.fullName.trim().split(/\s+/);
  const guardianContactId = await createGuardianContact(app.guardianName, user);
  const contact: Contact = {
    id: randomUUID(),
    name: app.fullName.trim(),
    firstName: firstName ?? app.fullName,
    lastName: rest.join(" ") || undefined,
    gender: app.gender,
    dob: app.dateOfBirth,
    phone: app.phone,
    email: app.email ?? undefined,
    address: app.address ?? undefined,
    notes: app.previousMadrasa ? `Previous madrasa: ${app.previousMadrasa}` : undefined,
    relationshipContacts: guardianRelationships(guardianContactId, app.guardianName),
  };
  const saved = await upsertContact(contact, user ? { user } : undefined);
  const created = await createStudent(
    {
      contactId: String(saved.contact.id),
      status: "active",
      enrollmentDate: today,
      guardianContactId,
      guardianName: guardianContactId ? null : app.guardianName.trim() || null,
    },
    user ? { user } : {},
  );
  return String(created.record.id);
}

/**
 * Approval = student (existing match or new contact + student) + enrollment through the regular
 * enrollment use case (fees, section placement, session membership), then the application is
 * marked approved. Each application is processed independently; failures are reported, not thrown.
 */
export async function approveApplications(
  subdomain: string,
  ids: string[],
  options: ApproveOptions,
): Promise<ApproveOutcome> {
  const outcome: ApproveOutcome = { updated: 0, failures: [] };
  const today = todayInTimeZone(await repo.findWorkspaceTimezone(subdomain));
  const apps = await withTenantRead(subdomain, (tx) =>
    repo.findApplicationsByIdsTx(tx, subdomain, ids),
  );
  for (const app of apps) {
    if (!canTransitionApplication(app.status, "approved")) {
      outcome.failures.push({
        id: app.id,
        message:
          app.status === "approved"
            ? "This application is already approved"
            : `An application in "${app.status}" cannot be approved`,
      });
      continue;
    }
    try {
      // One transaction per application: student/contact creation, enrollment, application
      // link and audit either all commit or all roll back. The nested use cases join this
      // transaction (withTenant is re-entrant), so a failure leaves no half-approved state.
      await runWithTenant(subdomain, async () => {
        await withTenant(subdomain, async (tx) => {
          const studentId =
            options.existingStudentId ??
            app.studentId ??
            (await createStudentFromApplication(app, today, options.user));
          // Already enrolled in the target session: link the existing row instead of asking
          // the bulk path for a seat it cannot grant (that would look like "class full").
          const alreadyEnrolled = await repo.findActivelyEnrolledStudentIds(
            subdomain,
            app.sessionId,
            [studentId],
          );
          if (alreadyEnrolled.size === 0) {
            const result = await bulkEnrollStudentsIntoClass(subdomain, {
              studentIds: [studentId],
              sessionId: app.sessionId,
              classId: app.classId,
              sectionId: options.sectionId ?? app.preferredSectionId ?? undefined,
              mode: "add",
              // The reviewer has made the decision and the public submission already passed
              // the eligibility rule; re-blocking here would strand an approved applicant
              // when the class's age/gender was edited after submission.
              ignoreEligibility: true,
            });
            // Zero enrolled = the class/section is full. Marking the application approved
            // would show a place the student does not have; leave it reviewable instead.
            if (result.succeeded === 0)
              throw new ConflictError(
                "The class is full — raise its capacity or waitlist the applicant before approving",
              );
          }
          const enrollmentId = await repo.findLatestEnrollmentId(subdomain, studentId, app.classId);
          await repo.updateApplicationTx(tx, subdomain, app.id, {
            status: "approved",
            studentId,
            enrollmentId,
            reviewedBy: options.actorUserId ?? "system",
          });
          await recordModernAuditEvent(tx, {
            workspaceSubdomain: subdomain,
            tableName: "registration_applications",
            recordId: app.id,
            actionType: "UPDATE",
            realUserId: options.actorUserId ?? undefined,
            newState: { status: "approved", studentId, enrollmentId },
          });
        });
      });
      outcome.updated += 1;
    } catch (error) {
      outcome.failures.push({
        id: app.id,
        message: error instanceof Error ? error.message : "Approval failed",
      });
    }
  }
  for (const id of ids) {
    if (!apps.some((app) => app.id === id))
      outcome.failures.push({ id, message: "Application not found" });
  }
  return outcome;
}
