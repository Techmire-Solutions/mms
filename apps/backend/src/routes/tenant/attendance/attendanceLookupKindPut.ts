import {
  ATTENDANCE_MODULE_MANIFEST,
  ATTENDANCE_LOOKUP_KINDS,
  attendanceLookupPutBodySchema,
  type AttendanceLookupKind,
  type AttendanceStatus,
} from "@mms/shared";
import { createLookupKindPutHandler } from "../../../lib/createLookupKindPutHandler.js";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";
import { replaceAttendanceLookupKind } from "../../../services/attendanceLookupsService.js";

/** `PUT /api/attendance/lookups/:kind` contract handler. */
export const putAttendanceLookupKind = createLookupKindPutHandler<
  AttendanceLookupKind,
  AttendanceStatus[]
>({
  kinds: ATTENDANCE_LOOKUP_KINDS,
  setupWritePermission: ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite,
  putBodySchema: attendanceLookupPutBodySchema,
  replaceKind: (kind, items) => replaceAttendanceLookupKind(kind, items),
  audit: createCollectionAuditHelper("attendance_records"),
  auditAction: "UPDATE_ATTENDANCE_LOOKUPS",
  saveError: "Failed to save attendance lookups",
});
