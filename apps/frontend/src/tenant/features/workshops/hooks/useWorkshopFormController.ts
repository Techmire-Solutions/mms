import { useRef, useState } from "react";
import {
  workshopEventCreateSchema,
  type AppTranslationKey,
  type WorkshopEvent,
  type WorkshopEventCreate,
  type WorkshopPreferences,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";

const VALIDATION_KEYS: readonly AppTranslationKey[] = [
  "workshops.validation.titleRequired",
  "workshops.validation.endBeforeStart",
  "workshops.validation.deadlineAfterEnd",
  "workshops.validation.spanTooLong",
];

function isValidationKey(message: string): message is AppTranslationKey {
  return VALIDATION_KEYS.some((key) => key === message);
}

export interface WorkshopFormValues {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  capacity: string;
  waitlistEnabled: boolean;
  fee: string;
  minAttendancePct: string;
  minScorePct: string;
}

const EMPTY: WorkshopFormValues = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  registrationDeadline: "",
  capacity: "",
  waitlistEnabled: false,
  fee: "",
  minAttendancePct: "",
  minScorePct: "",
};

function fromWorkshop(workshop: WorkshopEvent): WorkshopFormValues {
  return {
    title: workshop.title,
    description: workshop.description,
    startDate: workshop.startDate ?? "",
    endDate: workshop.endDate ?? "",
    registrationDeadline: workshop.registrationDeadline ?? "",
    capacity: workshop.capacity === null ? "" : String(workshop.capacity),
    waitlistEnabled: workshop.waitlistEnabled,
    fee: workshop.fee === null ? "" : String(workshop.fee),
    minAttendancePct: workshop.minAttendancePct === null ? "" : String(workshop.minAttendancePct),
    minScorePct: workshop.minScorePct === null ? "" : String(workshop.minScorePct),
  };
}

/** A new workshop starts from the Setup defaults for its completion criteria. */
function fromDefaults(defaults: WorkshopPreferences | null): WorkshopFormValues {
  const pct = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);
  return {
    ...EMPTY,
    minAttendancePct: pct(defaults?.defaultMinAttendancePct),
    minScorePct: pct(defaults?.defaultMinScorePct),
  };
}

const optionalNumber = (value: string): number | null =>
  value.trim() === "" ? null : Number(value.trim());

/** Form state for the workshop FormModal; saves through `onSave` and closes only on success. */
export function useWorkshopFormController({
  initialData,
  defaults,
  onSave,
  onClose,
}: {
  initialData: WorkshopEvent | null;
  defaults: WorkshopPreferences | null;
  onSave: (input: WorkshopEventCreate) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The page remounts the modal (new `key`) on every open, so the snapshot is set once here.
  const initialValues = useRef(
    initialData ? fromWorkshop(initialData) : fromDefaults(defaults),
  ).current;
  const [values, setValues] = useState<WorkshopFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);

  const setField = <K extends keyof WorkshopFormValues>(key: K, value: WorkshopFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    // A rapid double click can fire before React re-renders with `saving=true`; the ref is the
    // only synchronous guard, and it is released in `finally` so a 409 can be corrected and retried.
    if (submitLock.current) return;
    const parsed = workshopEventCreateSchema.safeParse({
      title: values.title,
      description: values.description,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      registrationDeadline: values.registrationDeadline || null,
      capacity: optionalNumber(values.capacity),
      // A waitlist without a capacity has no "full" trigger; never persist that combination.
      waitlistEnabled: values.capacity.trim() ? values.waitlistEnabled : false,
      fee: optionalNumber(values.fee),
      minAttendancePct: optionalNumber(values.minAttendancePct),
      minScorePct: optionalNumber(values.minScorePct),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "";
      setError(isValidationKey(message) ? t(message) : t("workshops.validation.invalid"));
      return;
    }
    submitLock.current = true;
    setSaving(true);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workshops.saveFailed"));
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  return {
    t,
    values,
    setField,
    error,
    saving,
    isDirty: Object.keys(initialValues).some(
      (key) =>
        values[key as keyof WorkshopFormValues] !== initialValues[key as keyof WorkshopFormValues],
    ),
    handleSubmit,
  };
}
