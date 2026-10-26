import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import { ADMISSIONS_BROADCAST_KEY } from "./registrationPublicUseCases.js";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/shared";
import { notificationsUseCases } from "../../notifications/use-cases/notificationsUseCases.js";

/**
 * A seat opened in a class (withdrawal / transfer out): the oldest waitlisted application for it is
 * flagged back into the admissions review queue and everyone who can act on admissions gets a
 * stored notification. Staff decide; nothing is enrolled automatically. Never throws — the
 * operation that freed the seat has already succeeded.
 */
export async function offerFreedSeat(
  tenant: string,
  classId: string,
): Promise<{ id: string; reference: string } | null> {
  try {
    const flagged = await repo.flagOldestWaitlistedApplication(tenant, classId);
    if (!flagged) return null;
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
