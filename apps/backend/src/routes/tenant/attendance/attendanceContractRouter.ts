import type { FastifyPluginAsync } from "fastify";
import { attendanceContract } from "@mms/shared";
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
  attendanceWidgetAggregatesHandler,
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
  const router = s.router(attendanceContract, {
    list: attendanceListHandler,
    create: attendanceCreateHandler,
    bulk: attendanceBulkHandler,
    bulkDelete: attendanceBulkDeleteHandler,
    bulkRestore: attendanceBulkRestoreHandler,
    update: attendanceUpdateHandler,
    delete: attendanceDeleteHandler,
    restore: attendanceRestoreHandler,
    widgetAggregates: attendanceWidgetAggregatesHandler,
    reportAggregates: attendanceReportAggregatesHandler,
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
