import {
  SESSIONS_MODULE_MANIFEST,
  SESSION_LOOKUP_KINDS,
  sessionLookupPutBodySchema,
  type SessionLookupKind,
} from "@mms/shared";
import { createLookupKindPutHandler } from "../../../lib/createLookupKindPutHandler.js";
import { replaceSessionLookupKind } from "../../../services/sessionLookupsService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { auditSession } from "./sessionRouteHelpers.js";

const handler = createLookupKindPutHandler<SessionLookupKind, string[]>({
  kinds: SESSION_LOOKUP_KINDS,
  setupWritePermission: SESSIONS_MODULE_MANIFEST.permissions.setupWrite,
  putBodySchema: sessionLookupPutBodySchema,
  replaceKind: (kind, items) => replaceSessionLookupKind(kind, items),
  audit: auditSession,
  auditAction: "session.lookups",
  saveError: "Failed to save session lookups",
});

/** `PUT /api/sessions/lookups/:kind` — replace + audit in one transaction. */
export const putSessionLookupKind: typeof handler = async (args) => {
  const tenant = getRequestTenant();
  if (!tenant) return handler(args);
  return withTenant(tenant, () => handler(args));
};
