/**
 * Attendance module capabilities.
 *
 * CSV import is intentionally **off**: the backend registers `POST /api/attendance/import`, but no
 * background runner exists for `attendance_records:import`, so the route always answers 503. Offering
 * the button (and the dialog) promised a flow that could never succeed; flip this constant when the
 * runner lands.
 */
export const ATTENDANCE_IMPORT_AVAILABLE = false;
