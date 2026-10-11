/**
 * Global settings SSOT: system-module registry + the GlobalSettings shape,
 * field-access keys, defaults, and merge/normalization.
 *
 * Stable barrel — split into focused modules to stay under the 300-line
 * ceiling; consumers keep importing from this path.
 */
export * from "./globalSettingsModuleRegistry.js";
export * from "./globalSettingsCore.js";
