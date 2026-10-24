/**
 * Configures Zod v4 to operate in CSP-safe (jitless) mode.
 * Disables dynamic code evaluation (`new Function("")` feature-probing and JIT compiler)
 * to comply with strict Content-Security-Policy rules (`script-src` without `'unsafe-eval'`).
 */
type ZodGlobalScope = { __zod_globalConfig?: { jitless?: boolean } };

const target: ZodGlobalScope =
  typeof globalThis !== "undefined"
    ? (globalThis as ZodGlobalScope)
    : typeof window !== "undefined"
      ? (window as ZodGlobalScope)
      : {};

target.__zod_globalConfig = Object.assign(target.__zod_globalConfig ?? {}, { jitless: true });

export const isZodJitless = true;
