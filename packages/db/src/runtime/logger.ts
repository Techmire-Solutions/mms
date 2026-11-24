/**
 * Structured logger for the data layer.
 *
 * The API's pino instance can be injected with `setDbLogger()` at boot; without
 * an injection the package logs through its own pino instance with the identical
 * redaction policy (`runtime/logRedaction.ts`), so a secret can never leak
 * whichever logger happens to be active.
 */
import { pino, type Logger } from "pino";
import { LOG_REDACTION_OPTIONS } from "./logRedaction.js";

function createDefaultLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service: "mms-db" },
    redact: LOG_REDACTION_OPTIONS,
  });
}

let active: Logger = createDefaultLogger();

/** Inject the application logger (e.g. the Fastify/worker pino instance). */
export function setDbLogger(logger: Logger): void {
  active = logger;
}

/** Restore the package default logger (tests only). */
export function resetDbLoggerForTesting(): void {
  active = createDefaultLogger();
}

export function getDbLogger(): Logger {
  return active;
}

/**
 * Facade so a later `setDbLogger()` takes effect for every call site (the moved
 * modules import `{ logger }` and call it at runtime).
 */
type LogFn = (...args: unknown[]) => void;

function delegate(level: "fatal" | "error" | "warn" | "info" | "debug" | "trace"): LogFn {
  return (...args: unknown[]) => {
    // Pino methods rely on their receiver (`this`), so bind to the active instance.
    const instance = getDbLogger();
    const target = instance[level] as unknown as LogFn;
    target.apply(instance, args);
  };
}

export const logger = {
  fatal: delegate("fatal"),
  error: delegate("error"),
  warn: delegate("warn"),
  info: delegate("info"),
  debug: delegate("debug"),
  trace: delegate("trace"),
} as unknown as Logger;
