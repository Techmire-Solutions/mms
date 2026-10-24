import { useState } from "react";
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
  // The page remounts the modal (new `key`) on every open, so initial state is set once here.
  const [values, setValues] = useState<WorkshopFormValues>(() =>
    initialData ? fromWorkshop(initialData) : fromDefaults(defaults),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof WorkshopFormValues>(key: K, value: WorkshopFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    const parsed = workshopEventCreateSchema.safeParse({
      title: values.title,
      description: values.description,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      registrationDeadline: values.registrationDeadline || null,
      capacity: optionalNumber(values.capacity),
      fee: optionalNumber(values.fee),
      minAttendancePct: optionalNumber(values.minAttendancePct),
      minScorePct: optionalNumber(values.minScorePct),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "";
      setError(isValidationKey(message) ? t(message) : t("workshops.validation.invalid"));
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workshops.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return {
    t,
    values,
    setField,
    error,
    saving,
    isDirty: Boolean(values.title.trim()),
    handleSubmit,
  };
}
