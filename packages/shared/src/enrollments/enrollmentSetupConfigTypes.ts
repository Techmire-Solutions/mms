/**
 * Enrollments Setup config: field registry, module preferences, and settings
 * composition. Stable barrel — split into focused modules to stay under the
 * 300-line ceiling; consumers keep importing from this path.
 */
export * from "./enrollmentSetupFields.js";
export * from "./enrollmentSetupPreferences.js";
export * from "./enrollmentSetupSettings.js";
