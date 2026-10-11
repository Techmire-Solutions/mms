import { describe, expect, it } from "vitest";
import {
  withTenant,
  withTenantRead,
  withGlobalTenant,
  type WithTenantOptions,
} from "../db/tenant-context.js";

/**
 * The runtime guard is unreachable through the typed API by design — a nullable
 * tenant without `allowGlobal` is now a compile error (see the overloads in
 * tenant-context.ts). These tests deliberately defeat the types to prove the
 * RUNTIME guard still fails closed for untyped/dynamic callers (JS consumers,
 * `as any` paths, and the pre-existing code this was added to protect).
 */
const withTenantLooselyTyped = withTenant as unknown as (
  tenantId: string | null | undefined,
  callback: (tx: unknown) => Promise<unknown>,
  options?: WithTenantOptions,
) => Promise<unknown>;

/**
 * Regression tests for the tenant-isolation fail-closed guard.
 *
 * A falsy tenant makes `applyTenantTransactionGuards` set
 * `app.rls_bypass = 'on'`, which makes every tenant RLS policy match ALL rows.
 * That must never happen implicitly: global access requires an explicit opt-in,
 * so a caller binding an unset request property fails loudly instead of
 * silently running without row-level security.
 */
describe("withTenant fail-closed guard", () => {
  it("rejects an empty tenant instead of bypassing RLS", async () => {
    await expect(withTenantLooselyTyped(null, async () => "ran")).rejects.toThrow(
      /refusing to run with RLS bypassed/,
    );
    await expect(withTenantLooselyTyped(undefined, async () => "ran")).rejects.toThrow(
      /refusing to run with RLS bypassed/,
    );
    await expect(withTenantLooselyTyped("", async () => "ran")).rejects.toThrow(
      /refusing to run with RLS bypassed/,
    );
  });

  it('rejects the literal strings "undefined"/"null" as tenant ids', async () => {
    await expect(withTenantLooselyTyped("undefined", async () => "ran")).rejects.toThrow(
      /literal string/,
    );
    await expect(withTenantLooselyTyped("null", async () => "ran")).rejects.toThrow(
      /literal string/,
    );
  });

  it("points the caller at the explicit global escape hatch", async () => {
    await expect(withTenantLooselyTyped(null, async () => "ran")).rejects.toThrow(
      /allowGlobal: true/,
    );
  });

  it("rejects an empty tenant even when readOnly is requested", async () => {
    await expect(
      withTenantLooselyTyped(null, async () => "ran", { readOnly: true }),
    ).rejects.toThrow(/refusing to run with RLS bypassed/);
  });

  it("allows global work through the explicit helper", async () => {
    // The guard must not reject an intentional global call. In the test
    // environment there is no pool, so `withTenant` falls back to running the
    // callback directly (see tenant-context.ts) rather than bypassing RLS.
    await expect(withGlobalTenant(async () => "ran")).resolves.toBe("ran");
  });
});

/**
 * Compile-time assertions.
 *
 * These never run — they exist so that loosening the overloads in
 * tenant-context.ts fails `tsc` instead of silently reintroducing the runtime
 * landmine. If a `@ts-expect-error` stops being an error, TypeScript reports an
 * unused directive and the build breaks.
 *
 * Background: the fail-closed guard was originally only a RUNTIME check. Code
 * whose tenant was `string | null | undefined` compiled fine and then threw
 * outside a request context, breaking migrations and seeding. The overloads make
 * that a build error; these lines keep them honest.
 */
declare const maybeTenant: string | null | undefined;
declare const aTenant: string;

export function __compileTimeAssertions(): void {
  // @ts-expect-error — a nullable tenant MUST pass an explicit `allowGlobal`.
  void withTenant(maybeTenant, async () => "ok");

  // @ts-expect-error — `allowGlobal` must be actually present, not omitted.
  void withTenant(maybeTenant, async () => "ok", { readOnly: true });

  // @ts-expect-error — same rule for the read-replica wrapper.
  void withTenantRead(maybeTenant, async () => "ok");

  // @ts-expect-error — and the global helper takes no tenant at all.
  void withGlobalTenant(aTenant, async () => "ok");

  // These must compile: a known-present tenant needs no opt-in.
  void withTenant(aTenant, async () => "ok");
  void withTenant(aTenant, async () => "ok", { readOnly: true });
  // A nullable tenant compiles once the opt-in is explicit.
  void withTenant(maybeTenant, async () => "ok", { allowGlobal: true });
  void withTenant(maybeTenant, async () => "ok", { allowGlobal: !maybeTenant });
}
