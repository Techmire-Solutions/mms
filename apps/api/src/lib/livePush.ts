import { configureModuleAccessInvalidator } from "@mms/be-core/realtime";
import { clearModuleAvailabilityCache } from "./moduleAvailabilityService.js";

// The kernel emitter stays app-free; this is the one app-owned cache hook.
configureModuleAccessInvalidator(clearModuleAvailabilityCache);

export * from "@mms/be-core/realtime";
