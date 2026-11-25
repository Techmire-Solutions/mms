/**
 * Port for the tenant auth guard's "is this account soft-deleted?" probe.
 *
 * `packages/be-core`'s `createTenantAuthGuard` already declares the port
 * (`isAccountSoftDeleted`); this module owns its *binding*. `middleware/` must not
 * import a domain (the previous implementation dynamically imported
 * `faculty/repository/facultyRepositoryAdapter`), so the faculty module registers
 * the implementation from the composition root
 * (`modules/faculty/adapters.ts` → `routes/index.ts`).
 *
 * Fail closed: an unconfigured guard throws instead of reporting "not deleted",
 * because silently treating a soft-deleted account as active would extend a
 * revoked session (docs/monorepo-migration-plan.md §8 P1a, U6).
 */
export type AccountDeletionResolver = (tenant: string, userId: string) => Promise<boolean>;

export class AccountDeletionGuardNotConfiguredError extends Error {
  constructor() {
    super(
      "Account deletion guard is not configured. Production call sites are wired by " +
        "routes/index.ts via configureFacultyAccountDeletionGuard(); tests must call " +
        "configureAccountDeletionGuard() in their setup.",
    );
    this.name = "AccountDeletionGuardNotConfiguredError";
  }
}

let resolver: AccountDeletionResolver | null = null;

/** Register (or clear, with `null`) the account-deletion resolver. */
export function configureAccountDeletionGuard(next: AccountDeletionResolver | null): void {
  resolver = next;
}

/** Fail-closed probe used by `createTenantAuthGuard`. */
export async function isAccountDeleted(tenant: string, userId: string): Promise<boolean> {
  if (!resolver) throw new AccountDeletionGuardNotConfiguredError();
  return resolver(tenant, userId);
}
