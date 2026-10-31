import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";

/** Thin Users audit helper — shared factory, same shape as Contacts/Faculty. */
export const auditUser = createCollectionAuditHelper("users", { subjectScoped: true });
