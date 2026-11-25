/**
 * Notifications tenant router. The app composition root wraps this in the
 * tenant-authentication scope (`authenticateTenant`) before registering it —
 * the module never imports app middleware.
 */
export { default as notificationsRoutes } from "./routes/notificationsRoutes.js";
