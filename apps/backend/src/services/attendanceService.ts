import { attendanceUseCases } from "../attendance/use-cases/attendanceUseCases.js";

/**
 * Thin re-export of the attendance use-cases facade.
 *
 * Kept for backward compatibility with existing importers (report routes,
 * tests). New code should depend on `attendance/use-cases/attendanceUseCases.js`
 * directly.
 */
export const loadAttendanceRecords = attendanceUseCases.loadAttendanceRecords;
export const createAttendanceRecord = attendanceUseCases.createAttendanceRecord;
export const updateAttendanceRecordById = attendanceUseCases.updateAttendanceRecordById;
export const deleteAttendanceRecordById = attendanceUseCases.deleteAttendanceRecordById;
export const restoreAttendanceRecordById = attendanceUseCases.restoreAttendanceRecordById;
export const bulkSoftDeleteAttendance = attendanceUseCases.bulkSoftDeleteAttendance;
export const bulkRestoreAttendance = attendanceUseCases.bulkRestoreAttendance;
export const replaceAttendanceRecords = attendanceUseCases.replaceAttendanceRecords;
export const upsertAttendanceRecords = attendanceUseCases.upsertAttendanceRecords;
export const loadAttendancePage = attendanceUseCases.loadAttendancePage;
export const countAttendanceRecords = attendanceUseCases.countAttendanceRecords;
export const loadAttendanceRecordById = attendanceUseCases.loadAttendanceRecordById;
export const loadAttendanceRecordsByIds = attendanceUseCases.loadAttendanceRecordsByIds;
export const loadAttendanceReportAggregates = attendanceUseCases.loadAttendanceReportAggregates;
export const loadAttendanceCommandMetrics = attendanceUseCases.loadAttendanceCommandMetrics;
export const loadAttendanceWidgetAggregates = attendanceUseCases.loadAttendanceWidgetAggregates;
