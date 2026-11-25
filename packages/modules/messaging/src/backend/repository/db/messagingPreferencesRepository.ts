import { eq, sql } from "drizzle-orm";
import type { MessagingPreferences } from "@mms/contracts";
import { messagingPreferences } from "@mms/db/schema";
import { withTenant } from "@mms/db/context";

function rowToPreferences(row: typeof messagingPreferences.$inferSelect): MessagingPreferences {
  return {
    defaultChannel: row.defaultChannel as MessagingPreferences["defaultChannel"],
    defaultSmsMode: row.defaultSmsMode as MessagingPreferences["defaultSmsMode"],
    defaultDispatchSpeed: row.defaultDispatchSpeed as MessagingPreferences["defaultDispatchSpeed"],
    defaultCountryCode: row.defaultCountryCode ?? "",
  };
}

/** Loads the tenant's messaging preferences row, or null when none exists. */
export async function loadMessagingPreferences(
  workspaceSubdomain: string,
): Promise<MessagingPreferences | null> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) return null;
  return withTenant(
    subdomain,
    async (tx) => {
      const rows = await tx
        .select({
          workspaceSubdomain: messagingPreferences.workspaceSubdomain,
          defaultChannel: messagingPreferences.defaultChannel,
          defaultSmsMode: messagingPreferences.defaultSmsMode,
          defaultDispatchSpeed: messagingPreferences.defaultDispatchSpeed,
          defaultCountryCode: messagingPreferences.defaultCountryCode,
          updatedAt: messagingPreferences.updatedAt,
        })
        .from(messagingPreferences)
        .where(eq(messagingPreferences.workspaceSubdomain, subdomain))
        .limit(1);
      return rows[0] ? rowToPreferences(rows[0]) : null;
    },
    { readOnly: true },
  );
}

/** Upserts the tenant's messaging preferences row. */
export async function saveMessagingPreferences(
  workspaceSubdomain: string,
  prefs: MessagingPreferences,
): Promise<void> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) return;
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(messagingPreferences)
      .values({
        workspaceSubdomain: subdomain,
        defaultChannel: prefs.defaultChannel,
        defaultSmsMode: prefs.defaultSmsMode,
        defaultDispatchSpeed: prefs.defaultDispatchSpeed,
        defaultCountryCode: prefs.defaultCountryCode,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: messagingPreferences.workspaceSubdomain,
        set: {
          defaultChannel: sql`excluded.default_channel`,
          defaultSmsMode: sql`excluded.default_sms_mode`,
          defaultDispatchSpeed: sql`excluded.default_dispatch_speed`,
          defaultCountryCode: sql`excluded.default_country_code`,
          updatedAt: new Date(),
        },
      });
  });
}
