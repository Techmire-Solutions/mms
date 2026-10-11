/**
 * Examinations Setup config: field registry, module preferences, and settings
 * composition. Stable barrel — split into focused modules to stay under the
 * 300-line ceiling; consumers keep importing from this path.
 */
export * from "./examinationsSetupFields.js";
export * from "./examinationsSetupPreferences.js";
export * from "./examinationsSetupSettings.js";
