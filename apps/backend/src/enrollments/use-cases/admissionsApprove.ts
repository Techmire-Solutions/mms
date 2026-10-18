import { randomUUID } from "node:crypto";
import type { Contact, User } from "@mms/shared";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import type { ApplicationJoinedRow } from "../repository/admissionsRepository.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { upsertContact } from "../../contacts/use-cases/contactWriteUseCases.js";
import { createStudent } from "../../students/use-cases/studentWriteUseCases.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
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

/** Creates the applicant's contact and student (Contacts own the person identity). */
async function createStudentFromApplication(
  app: ApplicationJoinedRow,
  today: string,
  user: User | undefined,
): Promise<string> {
  const [firstName, ...rest] = app.fullName.trim().split(/\s+/);
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
  };
  const saved = await upsertContact(contact, user ? { user } : undefined);
  const created = await createStudent(
    { contactId: String(saved.contact.id), status: "active", enrollmentDate: today },
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
    if (app.status === "approved") continue;
    try {
      await runWithTenant(subdomain, async () => {
        const studentId =
          options.existingStudentId ??
          app.studentId ??
          (await createStudentFromApplication(app, today, options.user));
        await bulkEnrollStudentsIntoClass(subdomain, {
          studentIds: [studentId],
          sessionId: app.sessionId,
          classId: app.classId,
          sectionId: options.sectionId ?? app.preferredSectionId ?? undefined,
          mode: "add",
        });
        const enrollmentId = await repo.findLatestEnrollmentId(subdomain, studentId, app.classId);
        await withTenant(subdomain, async (tx) => {
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
