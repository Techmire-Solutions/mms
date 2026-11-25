/**
 * `@mms/db/testing` — helpers for DB unit/integration tests.
 *
 * These exports are test-only support (resets + scope assertions); production code
 * must import from the regular entry points.
 */
export { configureDbConfig, loadServerConfig, resetDbConfigForTesting } from "./runtime/config.js";
export { resetDbLoggerForTesting, setDbLogger } from "./runtime/logger.js";
export { resetDbTracerForTesting, setDbTracer } from "./runtime/telemetry.js";
export { resetServiceUnavailableErrorFactoryForTesting } from "./runtime/errors.js";
export {
  getTenantScopeBypassEvent,
  inTenantScopeBypass,
  registerTenantScopeBypassSink,
  resetTenantScopeBypassSinksForTesting,
} from "./scope.js";
export { resolveMigrationsFolder } from "./migrations.js";
export { resolveSchemaSourceDirectory } from "./schema-source.js";
export { resolveSeedFixturesDirectory, seedFixturesAvailable } from "./seed/index.js";
export { inGlobalTenantScope, runWithGlobalTenantScope } from "./tenantScopeGuard.js";

/**
 * Assert that `fn` is rejected by the tenant guard (missing/empty tenant or a
 * literal "undefined"/"null" tenant). Returns the caught error for message checks.
 */
export async function expectTenantScopeError(fn: () => Promise<unknown>): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
  throw new Error("Expected the tenant scope guard to reject, but the call resolved.");
}
