import { isValidIsoDate, type Class } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ClassDetailTabId } from "./types";

/** Client-side class form validation; returns field errors and the tab that owns the first one. */
export function validateClassDraft(
  draft: Class,
  t: TranslationFunction,
): { errors: Record<string, string>; tab: ClassDetailTabId } {
  const next: Record<string, string> = {};
  let tab: ClassDetailTabId = "general";
  if (!draft.name?.trim()) {
    next.name = t("common.formPleaseFixErrors");
  }
  if (draft.minAge > 0 && draft.maxAge > 0 && draft.minAge > draft.maxAge) {
    next.maxAge = t("common.formPleaseFixErrors");
  }
  if ((draft.maxStudents ?? 0) < (draft.enrolled ?? 0)) {
    next.maxStudents = t("common.formPleaseFixErrors");
  }
  for (const schedule of draft.schedules ?? []) {
    if (schedule.startDate && !isValidIsoDate(schedule.startDate)) {
      next[`schedule.${schedule.id}.startDate`] = t("common.formPleaseFixErrors");
      tab = "schedule";
    }
    if (schedule.endDate && !isValidIsoDate(schedule.endDate)) {
      next[`schedule.${schedule.id}.endDate`] = t("common.formPleaseFixErrors");
      tab = "schedule";
    }
    if (schedule.startDate && schedule.endDate && schedule.endDate < schedule.startDate) {
      next[`schedule.${schedule.id}.endDate`] = t("common.formPleaseFixErrors");
      tab = "schedule";
    }
  }
  for (const timetable of draft.timetables ?? []) {
    for (const period of timetable.periods ?? []) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.endTime) ||
        period.startTime >= period.endTime ||
        !period.subject?.trim()
      ) {
        next[`period.${period.id}.time`] = t("common.formPleaseFixErrors");
        tab = "schedule";
      }
    }
  }
  for (const fee of draft.fees ?? []) {
    if (!(Number(fee.amount) > 0)) {
      next[`fee.${fee.id}.amount`] = t("common.formPleaseFixErrors");
      tab = "fees";
    }
  }
  for (const discount of draft.discounts ?? []) {
    if (Number(discount.percentage) < 0 || Number(discount.percentage) > 100) {
      next[`discount.${discount.id}.percentage`] = t("common.formPleaseFixErrors");
      tab = "fees";
    }
  }
  for (const budget of draft.budgets ?? []) {
    if (!(Number(budget.amount) > 0)) {
      next[`budget.${budget.id}.amount`] = t("common.formPleaseFixErrors");
      tab = "budget";
    }
  }
  for (const refreshment of draft.refreshments ?? []) {
    if (Number(refreshment.quantity) < 0 || Number(refreshment.pricePerUnit) < 0) {
      next[`refreshment.${refreshment.id}.amount`] = t("common.formPleaseFixErrors");
      tab = "budget";
    }
  }
  const scholarship = draft.scholarships?.[0];
  if (scholarship && (Number(scholarship.percentage) < 0 || Number(scholarship.percentage) > 100)) {
    next.scholarshipPercentage = t("common.formPleaseFixErrors");
    tab = "scholarship";
  }
  return { errors: next, tab };
}
