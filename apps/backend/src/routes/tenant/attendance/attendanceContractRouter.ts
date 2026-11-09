import type { FastifyPluginAsync } from "fastify";
import { ATTENDANCE_BULK_MAX_BYTES, attendanceContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import { putAttendanceLookupKind } from "./attendanceLookupKindPut.js";
import {
  attendanceListHandler,
  attendanceCreateHandler,
  attendanceUpdateHandler,
  attendanceDeleteHandler,
  attendanceRestoreHandler,
} from "./attendanceRecordHandlers.js";
import {
  attendanceBulkHandler,
  attendanceBulkDeleteHandler,
  attendanceBulkRestoreHandler,
} from "./attendanceBulkContractHandlers.js";
import {
  attendanceReopenDayHandler,
  attendanceSubmitDayHandler,
} from "./attendanceDaySubmissionHandlers.js";
import {
  attendanceCancelExcuseHandler,
  attendanceListExcusesHandler,
  attendanceReviewExcuseHandler,
  attendanceSubmitExcuseHandler,
} from "./attendanceLeaveHandlers.js";
import { attendanceRosterHandler } from "./attendanceRosterHandler.js";
import { attendanceMatrixExportHandler } from "./attendanceMatrixExportHandler.js";
import { attendanceCheckInHandler } from "./attendanceCheckInHandler.js";
import {
  attendanceListAbsenceAlertsHandler,
  attendanceResolveAbsenceAlertHandler,
  attendanceScanAbsenceStreaksHandler,
} from "./attendanceEscalationHandlers.js";
import {
  attendanceWidgetAggregatesHandler,
  attendanceMarkedDatesHandler,
  attendanceReportAggregatesHandler,
  attendanceGetFieldConfigHandler,
  attendanceUpdateFieldConfigHandler,
  attendanceGetPreferencesHandler,
  attendanceUpdatePreferencesHandler,
  attendanceGetLookupsHandler,
  attendanceGetLookupKindHandler,
} from "./attendanceSetupContractHandlers.js";

const s = initServer();

export const attendanceContractRouter: FastifyPluginAsync = async (fastify) => {
  /**
   * Refuse an oversized roster save before it is parsed.
   *
   * The 500-row Zod cap is the semantic limit; this is the byte limit. Without it the request was
   * read into memory and rejected by the process-wide body limit with a generic error.
   */
  fastify.addHook("onRequest", async (request, reply) => {
    if (request.method !== "PUT") return;
    if ((request.url.split("?")[0] ?? "") !== "/api/attendance/bulk") return;
    const declared = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declared) && declared > ATTENDANCE_BULK_MAX_BYTES) {
      await reply.status(413).send({
        type: "payload_too_large",
        message: `Bulk attendance payload exceeds ${ATTENDANCE_BULK_MAX_BYTES} bytes`,
      });
    }
  });

  const router = s.router(attendanceContract, {
    list: attendanceListHandler,
    getRoster: attendanceRosterHandler,
    exportMatrix: attendanceMatrixExportHandler,
    ingestCheckIns: attendanceCheckInHandler,
    create: attendanceCreateHandler,
    bulk: attendanceBulkHandler,
    bulkDelete: attendanceBulkDeleteHandler,
    bulkRestore: attendanceBulkRestoreHandler,
    submitDay: attendanceSubmitDayHandler,
    reopenDay: attendanceReopenDayHandler,
    listLeaves: attendanceListExcusesHandler,
    submitLeave: attendanceSubmitExcuseHandler,
    reviewLeave: attendanceReviewExcuseHandler,
    cancelLeave: attendanceCancelExcuseHandler,
    listAbsenceAlerts: attendanceListAbsenceAlertsHandler,
    scanAbsenceStreaks: attendanceScanAbsenceStreaksHandler,
    resolveAbsenceAlert: attendanceResolveAbsenceAlertHandler,
    update: attendanceUpdateHandler,
    delete: attendanceDeleteHandler,
    restore: attendanceRestoreHandler,
    widgetAggregates: attendanceWidgetAggregatesHandler,
    reportAggregates: attendanceReportAggregatesHandler,
    markedDates: attendanceMarkedDatesHandler,
    getFieldConfig: attendanceGetFieldConfigHandler,
    updateFieldConfig: attendanceUpdateFieldConfigHandler,
    getPreferences: attendanceGetPreferencesHandler,
    updatePreferences: attendanceUpdatePreferencesHandler,
    getLookups: attendanceGetLookupsHandler,
    getLookupKind: attendanceGetLookupKindHandler,
    updateLookupKind: putAttendanceLookupKind,
  } as unknown as RouterImplementation<typeof attendanceContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
