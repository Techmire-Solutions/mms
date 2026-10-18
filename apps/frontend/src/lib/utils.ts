import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges CSS class names using clsx and tailwind-merge.
 * @param inputs - List of class values to merge.
 * @returns The merged class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const isIframe: boolean = window.self !== window.top;

export { hexToHslToken as hexToTailwindHsl } from "@mms/shared";

export {
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatMonthName,
  formatDayName,
  formatLongDate,
  formatHijriDate,
  formatSolarHijriDate,
  toTitleCase,
  getInitials,
  todayISO,
  formatDateToIso,
  formatMoney,
  formatNumber,
  getRecentMonthsList,
  formatCnic,
  calcPercentage,
} from "@mms/shared";

export { optimizeImage } from "./imageOptimization";

export { isImeSafeEnter } from "@shared/ui";
