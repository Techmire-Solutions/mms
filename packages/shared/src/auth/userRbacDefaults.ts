/**
 * @file userRbacDefaults.ts
 * @description Default system roles, user status registries, activity registries, and permission map factories.
 *
 * Stable barrel: split into focused modules to stay under the 300-line ceiling;
 * consumers keep importing everything from this path.
 */
export * from "./userRbacPermissionMapOps.js";
export * from "./userRbacDefaultRoles.js";
export * from "./userRbacStatusRegistry.js";
export * from "./userRbacActivityRegistry.js";
