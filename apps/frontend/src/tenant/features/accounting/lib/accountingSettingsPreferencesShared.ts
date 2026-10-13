import type { AppTranslationKey } from "@mms/shared";

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"];
export const FY_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function localizedFiscalMonths(
  t: (key: AppTranslationKey) => string,
): Array<{ value: string; label: string }> {
  return FY_MONTHS.map((monthName) => ({
    value: monthName,
    label:
      t(`accounting.settings.months.${monthName.toLowerCase()}` as AppTranslationKey) || monthName,
  }));
}
