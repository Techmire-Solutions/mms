import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  evaluateEligibility,
  isWorkspaceEnabled,
  registrationSubmitSchema,
  REGISTRATION_INELIGIBLE_ERROR_TYPE,
  type PublicRegistrationView,
  type RegistrationApplicationStatus,
  type RegistrationSubmit,
} from '@mms/shared';
import { withTenant, withTenantRead } from '../../db/tenant-context.js';
import { findRegistrationLinkBySlugTx, listActiveRegistrationLinksTx } from '../../db/repositories/registrationLinkRepository.js';
import { countLinkSubmissionsTx, insertApplicationTx } from '../../db/repositories/registrationApplicationRepository.js';
import { findSessionById } from '../../db/repositories/sessionRepositoryQueries.js';
import { getWorkspaceBySubdomain } from '../../services/workspaceService.js';
import { findWorkspaceTimezone } from '../../db/repositories/workspaceRepository.js';
import { ConflictError, HttpDomainError, NotFoundError } from '../../lib/httpErrors.js';
import { isUniqueViolation } from '../../lib/pgErrors.js';
import { todayInTimeZone } from '../../lib/dbDate.js';
import { broadcastTenantUpdate } from '../../lib/livePush.js';
import { recordModernAuditEvent } from '../../services/auditTrailService.js';
import { linkClasses, toPublicView } from './registrationPublicView.js';
import { approveApplications } from './admissionsApprove.js';

export const ADMISSIONS_BROADCAST_KEY = 'registration_applications';
const NOT_FOUND = 'This registration link is not available';

async function requireWorkspace(subdomain: string) {
  const workspace = await getWorkspaceBySubdomain(subdomain);
  if (!workspace || !isWorkspaceEnabled(workspace)) throw new NotFoundError(NOT_FOUND);
  return workspace;
}

/** Human-friendly reference shared with the applicant (e.g. APP-7K2QX9MD). */
function newReference(): string {
  return `APP-${randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 8)}`;
}

export async function viewPublicRegistration(subdomain: string, slug: string): Promise<PublicRegistrationView> {
  const workspace = await requireWorkspace(subdomain);
  const link = await withTenantRead(subdomain, (tx) => findRegistrationLinkBySlugTx(tx, subdomain, slug));
  if (!link || !link.isActive) throw new NotFoundError(NOT_FOUND);
  const session = await findSessionById(subdomain, link.sessionId);
  if (!session || session.deletedAt) throw new NotFoundError(NOT_FOUND);
  return toPublicView(link, session, workspace.madrasaName ?? '', new Date());
}

export async function listOpenRegistrations(subdomain: string): Promise<PublicRegistrationView[]> {
  const workspace = await requireWorkspace(subdomain);
  const links = await withTenantRead(subdomain, (tx) => listActiveRegistrationLinksTx(tx, subdomain));
  const now = new Date();
  const views: PublicRegistrationView[] = [];
  for (const link of links) {
    const session = await findSessionById(subdomain, link.sessionId);
    if (!session || session.deletedAt) continue;
    const view = toPublicView(link, session, workspace.madrasaName ?? '', now);
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
  await requireWorkspace(subdomain);
  const now = new Date();
  const result = await withTenant(subdomain, async (tx) => {
    const link = await findRegistrationLinkBySlugTx(tx, subdomain, slug);
    if (!link || !link.isActive) throw new NotFoundError(NOT_FOUND);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:registration:${link.id}`}))`);
    const session = await findSessionById(subdomain, link.sessionId);
    const cls = session ? linkClasses(link, session).find((row) => row.id === input.classId) : undefined;
    if (!session || session.deletedAt || !cls) throw new NotFoundError(NOT_FOUND);
    if (link.maxSubmissions !== null && (await countLinkSubmissionsTx(tx, subdomain, link.id)) >= link.maxSubmissions) {
      throw new ConflictError('This registration has reached its limit');
    }
    const eligibility = evaluateEligibility({
      applicant: { dateOfBirth: input.dateOfBirth, gender: input.gender },
      cls: { ...cls, sections: cls.sections },
      session: { status: session.status, startDate: session.startDate },
      asOf: todayInTimeZone(await findWorkspaceTimezone(subdomain)),
      window: { opensAt: link.opensAt, closesAt: link.closesAt, now: now.toISOString() },
    });
    if (!eligibility.eligible) throw new HttpDomainError(422, REGISTRATION_INELIGIBLE_ERROR_TYPE, eligibility.reasons.join(','));
    const id = randomUUID();
    const reference = newReference();
    const status: RegistrationApplicationStatus = eligibility.waitlist ? 'waitlisted' : 'submitted';
    try {
      await insertApplicationTx(tx, subdomain, {
        id, reference, linkId: link.id, sessionId: session.id, classId: cls.id, preferredSectionId: null,
        fullName: input.fullName, guardianName: input.guardianName, dateOfBirth: input.dateOfBirth, gender: input.gender,
        phone: input.phone, email: input.email, address: input.address, previousMadrasa: input.previousMadrasa, status, submittedIpHash,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('An application for this applicant already exists');
      throw error;
    }
    await recordModernAuditEvent(tx, { workspaceSubdomain: subdomain, tableName: 'registration_applications', recordId: id,
      actionType: 'CREATE', newState: { reference, status, linkId: link.id, classId: cls.id } });
    return { id, reference, status, autoApprove: !link.requiresReview && status === 'submitted' };
  });
  let status: RegistrationApplicationStatus = result.status;
  if (result.autoApprove) {
    const outcome = await approveApplications(subdomain, [result.id], { actorUserId: null });
    if (outcome.failures.length === 0) status = 'approved';
  }
  broadcastTenantUpdate(subdomain, 'collection', ADMISSIONS_BROADCAST_KEY);
  return { reference: result.reference, status };
}
