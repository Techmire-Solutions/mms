import { ClassInsertSchema, isValidIsoDate, type Class } from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ClassDetailTabId } from "./types";

const TAB_IDS: readonly ClassDetailTabId[] = [
  "general",
  "sections",
  "schedule",
  "fees",
  "budget",
  "scholarship",
];

/**
 * Client-side class-form validation; returns field errors keyed by form field and the first tab
 * (in navigation order) that owns one.
 *
 * Shape and bounds come from the shared `ClassInsertSchema` (single source of truth), mapped back
 * to the flat keys the tab bodies render inline. A second pass keeps the business rules the shared
 * schema deliberately leaves to the client/back-end (cross-field and derived constraints):
 * age-range order, capacity vs. live enrollments, section-name uniqueness, positive fee/budget
 * amounts, HH:mm period times with a valid order, and non-reversed schedule dates.
 */
export function validateClassDraft(
  draft: Class,
  t: TranslationFunction,
): { errors: Record<string, string>; tab: ClassDetailTabId } {
  const errors: Record<string, string> = {};
  const erroredTabs = new Set<ClassDetailTabId>();
  const setError = (key: string, tab: ClassDetailTabId) => {
    if (!errors[key]) errors[key] = t("common.formPleaseFixErrors");
    erroredTabs.add(tab);
  };

  const parsed = ClassInsertSchema.safeParse(draft);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [top, index, field] = issue.path as [string, number, string];
      if (top === "sections") {
        const section = draft.sections?.[index];
        if (section?.id && (field === "name" || field === "capacity" || field === "room")) {
          setError(`section.${section.id}.${field}`, "sections");
        }
      } else if (top === "discounts") {
        const discount = draft.discounts?.[index];
        if (discount?.id && field === "percentage") {
          setError(`discount.${discount.id}.percentage`, "fees");
        }
      } else if (top === "refreshments") {
        const refreshment = draft.refreshments?.[index];
        if (refreshment?.id && (field === "quantity" || field === "pricePerUnit")) {
          setError(`refreshment.${refreshment.id}.amount`, "budget");
        }
      } else if (top === "scholarships") {
        if (field === "percentage") setError("scholarshipPercentage", "scholarship");
      }
    }
  }

  // Business rules (cross-field / derived) not owned by the shared schema.
  if (!draft.name?.trim()) setError("name", "general");
  if (draft.minAge > 0 && draft.maxAge > 0 && draft.minAge > draft.maxAge) {
    setError("maxAge", "general");
  }
  if ((draft.maxStudents ?? 0) < (draft.enrolled ?? 0)) setError("maxStudents", "general");

  const sectionNames = new Set<string>();
  for (const section of draft.sections ?? []) {
    const name = section.name?.trim() ?? "";
    const nameKey = name.toUpperCase();
    if (!name || sectionNames.has(nameKey)) setError(`section.${section.id}.name`, "sections");
    if (name) sectionNames.add(nameKey);
  }
  for (const schedule of draft.schedules ?? []) {
    if (schedule.startDate && !isValidIsoDate(schedule.startDate)) {
      setError(`schedule.${schedule.id}.startDate`, "schedule");
    }
    if (schedule.endDate && !isValidIsoDate(schedule.endDate)) {
      setError(`schedule.${schedule.id}.endDate`, "schedule");
    }
    if (schedule.startDate && schedule.endDate && schedule.endDate < schedule.startDate) {
      setError(`schedule.${schedule.id}.endDate`, "schedule");
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
        setError(`period.${period.id}.time`, "schedule");
      }
    }
  }
  for (const fee of draft.fees ?? []) {
    if (!(Number(fee.amount) > 0)) setError(`fee.${fee.id}.amount`, "fees");
  }
  for (const budget of draft.budgets ?? []) {
    if (!(Number(budget.amount) > 0)) setError(`budget.${budget.id}.amount`, "budget");
  }

  const tab = TAB_IDS.find((id) => erroredTabs.has(id)) ?? "general";
  return { errors, tab };
}
