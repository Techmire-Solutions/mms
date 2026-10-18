export interface ContactsReportAnalyticsSnapshot {
  total: number;
  activeCount: number;
  whatsappCount: number;
  whatsappRate: number;
  missingInfoCount: number;
  newLast30Days: number;
  newPrior30Days: number;
  newThisPeriod: number;
  hasSignupDates: boolean;
  growthRecentSignups30d: number;
  growthPriorSignups30d: number;
}

export interface ContactsMonthlyYearCounts {
  year: number;
  months: { month: string; count: number }[];
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const MONTH_LABELS_CACHE = new Map<string, string[]>();

function getMonthFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = FORMATTER_CACHE.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    FORMATTER_CACHE.set(locale, formatter);
  }
  return formatter;
}

/** Localized short month labels for comparison charts (falls back to English abbreviations). */
export function formatContactsMonthLabels(language = "en", monthCount = 12): string[] {
  const locale = language.trim() || "en";
  const cacheKey = `${locale}:${monthCount}`;
  const cached = MONTH_LABELS_CACHE.get(cacheKey);
  if (cached) return cached;

  try {
    const formatter = getMonthFormatter(locale);
    const result = Array.from({ length: monthCount }, (_, monthIndex) => {
      const label = formatter.format(new Date(Date.UTC(2020, monthIndex, 1)));
      return label || MONTH_LABELS[monthIndex] || String(monthIndex + 1);
    });
    MONTH_LABELS_CACHE.set(cacheKey, result);
    return result;
  } catch {
    const fallback = MONTH_LABELS.slice(0, monthCount).map(String);
    MONTH_LABELS_CACHE.set(cacheKey, fallback);
    return fallback;
  }
}
