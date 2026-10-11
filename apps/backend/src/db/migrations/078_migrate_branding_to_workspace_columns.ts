/**
 * Migration 078: Copy branding data from the `objects` store into the new
 * typed columns on the `workspaces` table (added by Drizzle migration 0071).
 *
 * Pattern matches existing setup-config migrations (062–067).
 * Idempotent — safe to re-run.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { mergeBrandingSettings, parseTenantScopedStorageKey } from "@mms/shared";

const BRANDING_KEY = "branding";

export async function runMigration078(): Promise<void> {
  console.log("Migrating branding from objects store → workspaces columns...");
  const db = getDb();

  const rows = await db.select().from(schema.objects);
  const brandingByTenant = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const parsed = parseTenantScopedStorageKey(row.key);
    if (!parsed) continue;
    const tenant = parsed.subdomain.trim().toLowerCase();
    if (!tenant) continue;
    if (parsed.logicalKey === BRANDING_KEY) {
      if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
        brandingByTenant.set(tenant, row.data as Record<string, unknown>);
      }
    }
  }

  let migrated = 0;

  await withGlobalTenant(async (tx) => {
    for (const [tenant, raw] of brandingByTenant) {
      const [workspace] = await tx
        .select({ subdomain: schema.workspaces.subdomain })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.subdomain, tenant))
        .limit(1);

      if (!workspace) {
        console.warn(`[Migration 078] Skipping orphaned branding for missing workspace: ${tenant}`);
        continue;
      }

      const b = mergeBrandingSettings(raw);

      await tx
        .update(schema.workspaces)
        .set({
          primaryColor: b.primaryColor || null,
          secondaryColor: b.secondaryColor || null,
          cornerStyle: b.cornerStyle || null,
          logoUrl: b.logoUrl || null,
          faviconUrl: b.faviconUrl || null,
          footerText: b.footerText || null,
          email: b.email || null,
          phone: b.phone || null,
          website: b.website || null,
          legalName: b.legalName || null,
          registrationNumber: b.registrationNumber || null,
          addressLine1: b.addressLine1 || null,
          addressLine2: b.addressLine2 || null,
          city: b.city || null,
          region: b.region || null,
          postalCode: b.postalCode || null,
          socialLinks: b.socialLinks?.length ? b.socialLinks : null,
          // Keep name/tagline aligned (branding is source of truth for display values)
          madrasaName: b.madrasaName || undefined,
          tagline: b.tagline || null,
        })
        .where(eq(schema.workspaces.subdomain, tenant));

      migrated++;
    }
  });

  console.log(`[Migration 078] Migrated branding for ${migrated} workspace(s).`);
}
