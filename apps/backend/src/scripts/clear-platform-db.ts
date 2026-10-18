/**
 * @deprecated Misnamed — this wiped the ENTIRE app database, not platform tables.
 * Use `reset-app-db.ts` or `pnpm --filter mms-backend db:reset` instead.
 *
 * This shim loads reset-app-db so old invocations still work after a deprecation warning.
 */
console.warn(
  "[deprecated] clear-platform-db.ts wipes the ENTIRE database (not platform-only). " +
    "Use reset-app-db.ts or `pnpm --filter mms-backend db:reset` instead.",
);

void import("./reset-app-db.js");
