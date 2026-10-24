import { sql } from "drizzle-orm";
import type { FiscalYear } from "@mms/shared";
import { accountingPostingPeriods } from "../schema.js";
import type { withTenant } from "../tenant-context.js";

export interface PostingPeriodSeed {
  id: string;
  fiscalYearId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

/** Generates calendar-month posting periods with inclusive ISO day boundaries. */
export function generatePostingPeriods(
  year: Pick<FiscalYear, "id" | "startDate" | "endDate" | "status">,
): PostingPeriodSeed[] {
  const periods: PostingPeriodSeed[] = [];
  let cursor = year.startDate;
  while (cursor <= year.endDate) {
    const [yearPart, monthPart] = cursor.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(yearPart!, monthPart!, 0)).toISOString().slice(0, 10);
    const endDate = monthEnd < year.endDate ? monthEnd : year.endDate;
    periods.push({
      id: `${year.id}-${cursor.slice(0, 7)}`,
      fiscalYearId: year.id,
      label: cursor.slice(0, 7),
      startDate: cursor,
      endDate,
      status: year.status === "closed" ? "closed" : "open",
    });
    cursor = new Date(Date.UTC(yearPart!, monthPart!, 1)).toISOString().slice(0, 10);
  }
  return periods;
}

export async function syncPostingPeriods(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  subdomain: string,
  records: FiscalYear[],
): Promise<void> {
  const periods = records.flatMap(generatePostingPeriods);
  if (periods.length === 0) return;
  await tx
    .insert(accountingPostingPeriods)
    .values(periods.map((period) => ({ ...period, workspaceSubdomain: subdomain })))
    .onConflictDoUpdate({
      target: [accountingPostingPeriods.workspaceSubdomain, accountingPostingPeriods.id],
      set: {
        label: sql`excluded.label`,
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        status: sql`case when excluded.status = 'closed' then 'closed' else ${accountingPostingPeriods.status} end`,
        updatedAt: new Date(),
      },
    });
}
