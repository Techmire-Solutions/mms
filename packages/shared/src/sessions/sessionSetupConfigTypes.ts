/**
 * Sessions Setup config: field registry, module preferences, and settings
 * composition (SSOT). Stable barrel — split into focused modules to stay under
 * the 300-line ceiling; consumers keep importing from this path.
 */
export * from "./sessionSetupFields.js";
export * from "./sessionSetupPreferences.js";
export * from "./sessionSetupSettings.js";
