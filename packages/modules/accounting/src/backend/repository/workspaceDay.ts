import { eq } from "drizzle-orm";
import { activeDb } from "@mms/db/client";
import { workspaces } from "@mms/db/schema";
import { todayInTimeZone } from "./dbDate.js";

/** Today's calendar day for `tenant`, using the workspace's configured IANA timezone. */
export async function workspaceTodayIso(tenant: string): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const rows = await activeDb()
    .select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.subdomain, subdomain))
    .limit(1);
  return todayInTimeZone(rows[0]?.timezone);
}
