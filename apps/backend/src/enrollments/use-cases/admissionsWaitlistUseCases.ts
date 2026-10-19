import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import { ADMISSIONS_BROADCAST_KEY } from "./registrationPublicUseCases.js";

/**
 * A seat opened in a class (withdrawal / transfer out): the oldest waitlisted application for it is
 * flagged back into the admissions review queue. Staff decide; nothing is enrolled automatically.
 * Never throws — the operation that freed the seat has already succeeded.
 */
export async function offerFreedSeat(
  tenant: string,
  classId: string,
): Promise<{ id: string; reference: string } | null> {
  try {
    const flagged = await repo.flagOldestWaitlistedApplication(tenant, classId);
    if (flagged) broadcastTenantUpdate(tenant, "collection", ADMISSIONS_BROADCAST_KEY);
    return flagged;
  } catch (error) {
    logger.warn({ err: error, classId }, "waitlist seat offer failed");
    return null;
  }
}
