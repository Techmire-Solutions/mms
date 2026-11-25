/**
 * Audit tenant router. The app composition root wraps this in the
 * tenant-authentication scope (`authenticateTenant`) before registering it —
 * the module never imports app middleware.
 */
export { auditRoutes } from "./routes/auditRoutes.js";
