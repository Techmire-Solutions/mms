import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";

/** Thin Sessions audit helper — shared factory, same shape as Contacts/Faculty. */
export const auditSession = createCollectionAuditHelper("sessions");
