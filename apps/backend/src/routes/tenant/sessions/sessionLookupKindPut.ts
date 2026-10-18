import {
  SESSIONS_MODULE_MANIFEST,
  SESSION_LOOKUP_KINDS,
  sessionLookupPutBodySchema,
  type SessionLookupKind,
} from "@mms/shared";
import { createLookupKindPutHandler } from "../../../lib/createLookupKindPutHandler.js";
import { replaceSessionLookupKind } from "../../../services/sessionLookupsService.js";
import { auditSession } from "./sessionRouteHelpers.js";

/** `PUT /api/sessions/lookups/:kind` contract handler. */
export const putSessionLookupKind = createLookupKindPutHandler<SessionLookupKind, string[]>({
  kinds: SESSION_LOOKUP_KINDS,
  setupWritePermission: SESSIONS_MODULE_MANIFEST.permissions.setupWrite,
  putBodySchema: sessionLookupPutBodySchema,
  replaceKind: (kind, items) => replaceSessionLookupKind(kind, items),
  audit: auditSession,
  auditAction: "session.lookups",
  saveError: "Failed to save session lookups",
});
