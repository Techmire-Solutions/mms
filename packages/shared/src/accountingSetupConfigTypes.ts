/**
 * Accounting Setup config: field registry, module preferences, and settings
 * composition. Stable barrel — split into focused modules to stay under the
 * 300-line ceiling; consumers keep importing from this path.
 */
export * from "./accountingSetupFields.js";
export * from "./accountingSetupPreferences.js";
export * from "./accountingSetupSettings.js";
