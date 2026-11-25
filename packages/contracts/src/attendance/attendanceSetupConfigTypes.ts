/**
 * Attendance Setup config: field registry, module preferences, and settings
 * composition. Stable barrel — split into focused modules to stay under the
 * 300-line ceiling; consumers keep importing from this path.
 */
export * from "./attendanceSetupFields.js";
export * from "./attendanceSetupPreferences.js";
export * from "./attendanceSetupSettings.js";
