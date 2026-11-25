import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import {
  normalizeAccountingModulePreferences,
  voucherCalendarYear,
  type VoucherNumberingUpdate,
} from "@mms/contracts";
import { accountingFiscalYears } from "@mms/db/schema";
import type { TenantTransaction } from "@mms/db/context";
import { getAccountingModulePreferences } from "./accountingModulePreferencesRepository.js";
import { workspaceTodayIso } from "./workspaceDay.js";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export interface VoucherPeriod {
  /** Counter bucket: `0` when numbering never restarts. */
  periodYear: number;
  /** Year printed in the ref: the period, or the voucher's calendar year when it never restarts. */
  printYear: number;
  /** Month (1-12) printed in the ref for `YYYYMM` formats, else the voucher's calendar month. */
  printMonth: number;
}

/** Start year of the fiscal year containing `date`: the stored fiscal year, else the `fyStartMonth` preference. */
async function fiscalStartYear(
  tx: TenantTransaction,
  subdomain: string,
  date: string,
): Promise<number> {
  const [covering] = await tx
    .select({ startDate: accountingFiscalYears.startDate })
    .from(accountingFiscalYears)
    .where(
      and(
        eq(accountingFiscalYears.workspaceSubdomain, subdomain),
        isNull(accountingFiscalYears.deletedAt),
        lte(accountingFiscalYears.startDate, date),
        gte(accountingFiscalYears.endDate, date),
      ),
    )
    .orderBy(desc(accountingFiscalYears.startDate))
    .limit(1);
  if (covering) return Number(covering.startDate.slice(0, 4));
  const { fyStartMonth } = normalizeAccountingModulePreferences(
    await getAccountingModulePreferences(subdomain),
  );
  const startMonth = Math.max(0, MONTHS.indexOf(fyStartMonth.trim().toLowerCase()));
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) - 1 >= startMonth ? year : year - 1;
}

export async function resolveVoucherPeriod(
  tx: TenantTransaction,
  subdomain: string,
  config: Pick<VoucherNumberingUpdate, "rolloverPolicy">,
  date: string | undefined,
): Promise<VoucherPeriod> {
  // The workspace's business day, not the UTC day: a Karachi tenant at 02:00 local
  // still reports the previous UTC date, which previewed the wrong rollover year.
  const today = await workspaceTodayIso(subdomain);
  const voucherDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const calendarYear = voucherCalendarYear(voucherDate, new Date().getFullYear());
  const calendarMonth = Number(voucherDate.slice(5, 7)) || new Date().getMonth() + 1;
  if (config.rolloverPolicy === "never")
    return { periodYear: 0, printYear: calendarYear, printMonth: calendarMonth };
  if (config.rolloverPolicy === "monthly")
    return {
      periodYear: calendarYear * 100 + calendarMonth,
      printYear: calendarYear,
      printMonth: calendarMonth,
    };
  if (config.rolloverPolicy === "annual_calendar")
    return { periodYear: calendarYear, printYear: calendarYear, printMonth: calendarMonth };
  const fiscal = await fiscalStartYear(tx, subdomain, voucherDate);
  return { periodYear: fiscal, printYear: fiscal, printMonth: calendarMonth };
}
