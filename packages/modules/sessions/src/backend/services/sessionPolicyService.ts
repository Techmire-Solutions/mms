import { configurePlatformIdleMinutesProvider } from "@mms/be-core/auth/sessionPolicy";
import { getPlatformIdleSessionMinutes } from "../deps.js";

configurePlatformIdleMinutesProvider(() => getPlatformIdleSessionMinutes());

export * from "@mms/be-core/auth/sessionPolicy";
