import { randomBytes, randomUUID } from "node:crypto";
import {
  evaluateEligibility,
  isWorkspaceEnabled,
  registrationSubmitSchema,
  REGISTRATION_INELIGIBLE_ERROR_TYPE,
  type PublicRegistrationView,
  type RegistrationApplicationStatus,
  type RegistrationSubmit,
} from "@mms/shared";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import { getWorkspaceBySubdomain } from "../../services/workspaceService.js";
import { ConflictError, HttpDomainError, NotFoundError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { linkClasses, toPublicView } from "./registrationPublicView.js";
import { approveApplications } from "./admissionsApprove.js";
import { sendRegistrationAcknowledgement } from "./registrationAcknowledgement.js";
import { runWithTenant } from "../../lib/tenantContext.js";

export const ADMISSIONS_BROADCAST_KEY = "registration_applications";
const NOT_FOUND = "This registration link is not available";

async function requireWorkspace(subdomain: string) {
  const workspace = await getWorkspaceBySubdomain(subdomain);
  if (!workspace || !isWorkspaceEnabled(workspace)) throw new NotFoundError(NOT_FOUND);
  return workspace;
}

/** Human-friendly reference shared with the applicant (e.g. APP-7K2QX9MD). */
function newReference(): string {
  return `APP-${randomBytes(6)
    .toString("base64url")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X")
    .slice(0, 8)}`;
}

export async function viewPublicRegistration(
  subdomain: string,
  slug: string,
): Promise<PublicRegistrationView> {
  const workspace = await requireWorkspace(subdomain);
  const link = await withTenantRead(subdomain, (tx) =>
    repo.findRegistrationLinkBySlugTx(tx, subdomain, slug),
  );
  if (!link || !link.isActive) throw new NotFoundError(NOT_FOUND);
  const session = await repo.findSessionById(subdomain, link.sessionId);
  if (!session || session.deletedAt) throw new NotFoundError(NOT_FOUND);
  return toPublicView(link, session, workspace.madrasaName ?? "", new Date());
}

export async function listOpenRegistrations(subdomain: string): Promise<PublicRegistrationView[]> {
  const workspace = await requireWorkspace(subdomain);
  const links = await withTenantRead(subdomain, (tx) =>
    repo.listActiveRegistrationLinksTx(tx, subdomain),
  );
  const now = new Date();
  const views: PublicRegistrationView[] = [];
  for (const link of links) {
    const session = await repo.findSessionById(subdomain, link.sessionId);
    if (!session || session.deletedAt) continue;
    const view = toPublicView(link, session, workspace.madrasaName ?? "", now);
    if (view.acceptingSubmissions) views.push(view);
  }
  return views;
}

/**
 * Public submission: re-validates link window, cap and eligibility on the server, stores the
 * application (waitlisted when the class is full) and auto-approves when the link skips review.
 */
export async function submitPublicRegistration(
  subdomain: string,
  slug: string,
  body: RegistrationSubmit,
  submittedIpHash: string | null,
): Promise<{ reference: string; status: RegistrationApplicationStatus }> {
  const input = registrationSubmitSchema.parse(body);
  const workspace = await requireWorkspace(subdomain);
  const now = new Date();
  const result = await withTenant(subdomain, async (tx) => {
    const link = await repo.findRegistrationLinkBySlugTx(tx, subdomain, slug);
    if (!link || !link.isActive) throw new NotFoundError(NOT_FOUND);
    await repo.lockRegistrationLinkTx(tx, subdomain, link.id);
    const session = await repo.findSessionById(subdomain, link.sessionId);
    const cls = session
      ? linkClasses(link, session).find((row) => row.id === input.classId)
      : undefined;
    if (!session || session.deletedAt || !cls) throw new NotFoundError(NOT_FOUND);
    if (
      link.maxSubmissions !== null &&
      (await repo.countLinkSubmissionsTx(tx, subdomain, link.id)) >= link.maxSubmissions
    ) {
      throw new ConflictError("This registration has reached its limit");
    }
    const eligibility = evaluateEligibility({
      applicant: { dateOfBirth: input.dateOfBirth, gender: input.gender },
      cls: { ...cls, sections: cls.sections },
      session: { status: session.status, startDate: session.startDate },
      asOf: todayInTimeZone(await repo.findWorkspaceTimezone(subdomain)),
      window: { opensAt: link.opensAt, closesAt: link.closesAt, now: now.toISOString() },
    });
    if (!eligibility.eligible)
      throw new HttpDomainError(
        422,
        REGISTRATION_INELIGIBLE_ERROR_TYPE,
        eligibility.reasons.join(","),
      );
    const id = randomUUID();
    const reference = newReference();
    const status: RegistrationApplicationStatus = eligibility.waitlist ? "waitlisted" : "submitted";
    try {
      await repo.insertApplicationTx(tx, subdomain, {
        id,
        reference,
        linkId: link.id,
        sessionId: session.id,
        classId: cls.id,
        preferredSectionId: null,
        fullName: input.fullName,
        guardianName: input.guardianName,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        address: input.address,
        previousMadrasa: input.previousMadrasa,
        status,
        submittedIpHash,
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError("An application for this applicant already exists");
      throw error;
    }
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "registration_applications",
      recordId: id,
      actionType: "CREATE",
      newState: { reference, status, linkId: link.id, classId: cls.id },
    });
    return { id, reference, status, autoApprove: !link.requiresReview && status === "submitted" };
  });
  let status: RegistrationApplicationStatus = result.status;
  if (result.autoApprove) {
    const outcome = await approveApplications(subdomain, [result.id], { actorUserId: null });
    if (outcome.failures.length === 0) status = "approved";
  }
  // Public route, so there is no ambient tenant context for the SMS provider lookup to ride on.
  await runWithTenant(subdomain, () =>
    sendRegistrationAcknowledgement({
      phone: input.phone,
      reference: result.reference,
      status,
      workspaceName: workspace.madrasaName,
    }),
  );
  broadcastTenantUpdate(subdomain, "collection", ADMISSIONS_BROADCAST_KEY);
  return { reference: result.reference, status };
}
