import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";

/** Thin Enrollments audit helper — shared factory, same shape as Contacts/Faculty. */
export const auditEnrollment = createCollectionAuditHelper("enrollments");
