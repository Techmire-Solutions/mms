import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import { ADMISSIONS_BROADCAST_KEY } from "./registrationPublicUseCases.js";
import { ENROLLMENTS_MODULE_MANIFEST, normalizeEnrollmentModulePreferences } from "@mms/shared";
import { notificationsUseCases } from "../../notifications/use-cases/notificationsUseCases.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { hasActiveTransaction } from "../../db/dbTransactions.js";

/**
 * A seat opened in a class (withdrawal / transfer out / trash / capacity increase): the oldest
 * waitlisted application for it is flagged back into the admissions review queue with a time
 * window, and everyone who can act on admissions gets a stored notification. Staff decide;
 * nothing is enrolled automatically and no seat is hard-reserved.
 *
 * Must run **after** the freeing transaction commits (`runAfterCommit`): a failure here must not
 * abort the operation that already succeeded, and the section lock must not be held while the
 * application row and the notification are written. Never throws.
 */
export async function offerFreedSeat(
  tenant: string,
  classId: string,
): Promise<{ id: string; reference: string } | null> {
  try {
    const preferences = normalizeEnrollmentModulePreferences(
      await repo.getEnrollmentModulePreferencesByWorkspace(tenant),
    );
    if (!preferences.waitlistEnabled) return null;
    const offerHours = Number.parseInt(preferences.waitlistOfferHours, 10) || 72;
    const flagged = await repo.flagOldestWaitlistedApplication(tenant, classId, offerHours);
    if (!flagged) return null;
    // Own transaction: the caller has already committed, so this row is the only trace of the offer.
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "registration_applications",
      recordId: flagged.id,
      actionType: "UPDATE",
      newState: {
        operation: "waitlist_offer",
        classId,
        expiresAt: flagged.expiresAt,
      },
    });
    broadcastTenantUpdate(tenant, "collection", ADMISSIONS_BROADCAST_KEY);
    await notificationsUseCases.notify(tenant, {
      kind: "waitlist_seat_offered",
      audiencePermission: ENROLLMENTS_MODULE_MANIFEST.permissions.write,
      entityType: "registration_application",
      entityId: flagged.id,
      subjectLabel: `${flagged.fullName} (${flagged.reference})`,
      contextLabel: flagged.className,
    });
    return { id: flagged.id, reference: flagged.reference };
  } catch (error) {
    logger.warn({ err: error, classId }, "waitlist seat offer failed");
    return null;
  }
}

/**
 * Runs the offer after the enclosing transaction (if any) commits. Outside a transaction the
 * offer is awaited so callers/tests observe the flagged application deterministically.
 */
export async function offerFreedSeatPostCommit(tenant: string, classId: string): Promise<void> {
  if (hasActiveTransaction()) {
    runAfterCommit(() => {
      void offerFreedSeat(tenant, classId);
    });
    return;
  }
  await offerFreedSeat(tenant, classId);
}
