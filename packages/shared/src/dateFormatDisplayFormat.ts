import { normalizeDateFormat } from "./dateFormatPresets.js";

/**
 * Formats numeric day/month/year parts using a preset pattern.
 */
export function formatDateParts(
  day: number,
  month: number,
  year: number,
  formatId: string,
): string {
  const id = normalizeDateFormat(formatId);
  const paddedDay = String(day).padStart(2, "0");
  const paddedMonth = String(month).padStart(2, "0");
  const fullYear = String(year);

  switch (id) {
    case "MM/DD/YYYY":
      return `${paddedMonth}/${paddedDay}/${fullYear}`;
    case "YYYY-MM-DD":
      return `${fullYear}-${paddedMonth}-${paddedDay}`;
    case "DD-MM-YYYY":
      return `${paddedDay}-${paddedMonth}-${fullYear}`;
    case "DD.MM.YYYY":
      return `${paddedDay}.${paddedMonth}.${fullYear}`;
    case "YYYY/MM/DD":
      return `${fullYear}/${paddedMonth}/${paddedDay}`;
    case "DD/MM/YYYY":
    default:
      return `${paddedDay}/${paddedMonth}/${fullYear}`;
  }
}

/**
 * Formats with a short month name according to preset ordering.
 */
export function formatDatePartsWithMonthName(
  day: number,
  monthLabel: string,
  monthNum: number,
  year: number,
  formatId: string,
): string {
  const id = normalizeDateFormat(formatId);
  const paddedMonth = String(monthNum).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");

  if (id === "MM/DD/YYYY") {
    return `${monthLabel} ${day}, ${year}`;
  }
  if (id === "YYYY-MM-DD" || id === "YYYY/MM/DD") {
    return `${year}-${paddedMonth}-${paddedDay}`;
  }
  return `${day} ${monthLabel} ${year}`;
}

/**
 * Formats numeric month/year parts using a preset pattern.
 */
export function formatMonthYearParts(month: number, year: number, formatId: string): string {
  const id = normalizeDateFormat(formatId);
  const paddedMonth = String(month).padStart(2, "0");
  const fullYear = String(year);

  switch (id) {
    case "YYYY-MM-DD":
      return `${fullYear}-${paddedMonth}`;
    case "YYYY/MM/DD":
      return `${fullYear}/${paddedMonth}`;
    case "DD.MM.YYYY":
      return `${paddedMonth}.${fullYear}`;
    case "DD-MM-YYYY":
      return `${paddedMonth}-${fullYear}`;
    case "MM/DD/YYYY":
    case "DD/MM/YYYY":
    default:
      return `${paddedMonth}/${fullYear}`;
  }
}

/**
 * Converts an ISO storage date (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`) to the active display pattern.
 */
export function formatIsoDateToDisplay(iso: string | null | undefined, formatId: string): string {
  if (!iso) return "";
  const dateOnly = iso.trim().split(/[T\s]/)[0];
  if (!dateOnly) return "";
  const parts = dateOnly.split("-");

  // Year only: "2024"
  if (parts.length === 1 && /^\d{4}$/.test(parts[0]!)) {
    return parts[0]!;
  }

  // Month and Year: "2024-05"
  if (parts.length === 2 && /^\d{4}$/.test(parts[0]!) && /^\d{1,2}$/.test(parts[1]!)) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (year >= 1000 && year <= 9999 && month >= 1 && month <= 12) {
      return formatMonthYearParts(month, year, formatId);
    }
  }

  // Complete Date: "2024-05-21"
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (year && month && day) {
      return formatDateParts(day, month, year, formatId);
    }
  }

  return iso;
}

/**
 * Converts an ISO storage date (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`) to a human-readable display string
 * using the provided month label.
 */
export function formatIsoDateToDisplayWithMonthName(
  iso: string | null | undefined,
  formatId: string,
  monthLabel: string,
): string {
  if (!iso) return "";
  const dateOnly = iso.trim().split(/[T\s]/)[0];
  if (!dateOnly) return "";
  const parts = dateOnly.split("-");

  if (parts.length === 1 && /^\d{4}$/.test(parts[0]!)) {
    return parts[0]!;
  }

  if (parts.length === 2 && /^\d{4}$/.test(parts[0]!) && /^\d{1,2}$/.test(parts[1]!)) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (year >= 1000 && year <= 9999 && month >= 1 && month <= 12) {
      const id = normalizeDateFormat(formatId);
      if (id.startsWith("YYYY")) {
        return `${year} ${monthLabel}`;
      }
      return `${monthLabel} ${year}`;
    }
  }

  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (year && month && day) {
      return formatDatePartsWithMonthName(day, monthLabel, month, year, formatId);
    }
  }

  return iso;
}
