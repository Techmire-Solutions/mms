import type { Matcher } from "react-day-picker";
import { parseFlexibleIsoDate, resolveDatePickerMonthBounds } from "@mms/shared";
import { isRadixSelectPortalTarget } from "@/components/ui/select";

export function resolveInitialDisplayMonth(
  targetDate?: Date,
  minIso?: string | number | null,
  maxIso?: string | number | null,
): Date {
  if (targetDate) return targetDate;
  const today = new Date();
  const minDate = typeof minIso === "string" ? parseFlexibleIsoDate(minIso) : undefined;
  if (minDate && today < minDate) return minDate;
  const maxDate = typeof maxIso === "string" ? parseFlexibleIsoDate(maxIso) : undefined;
  if (maxDate && today > maxDate) return maxDate;
  return today;
}

export function resolveDisabledDays(
  minIsoStr?: string,
  maxIsoStr?: string,
  isYearMode?: boolean,
): Matcher[] | undefined {
  if (isYearMode) return undefined;
  const rules: Matcher[] = [];
  const minDate = parseFlexibleIsoDate(minIsoStr);
  if (minDate) rules.push({ before: minDate });
  const maxDate = parseFlexibleIsoDate(maxIsoStr);
  if (maxDate) rules.push({ after: maxDate });
  return rules.length > 0 ? rules : undefined;
}

export function resolveDatePickerHiddenValue(
  value: string | number | Date | null | undefined,
  isYearMode: boolean,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value instanceof Date) {
    return isYearMode ? String(value.getFullYear()) : value.toISOString().split("T")[0];
  }
  return "";
}

export function keepOpenForChrome(
  event: { target: EventTarget | null; preventDefault: () => void },
  rootNode: HTMLElement | null,
): void {
  const target = event.target;
  if (isRadixSelectPortalTarget(target)) {
    event.preventDefault();
    return;
  }
  if (target instanceof Node && rootNode?.contains(target)) {
    event.preventDefault();
  }
}

export { resolveDatePickerMonthBounds };
