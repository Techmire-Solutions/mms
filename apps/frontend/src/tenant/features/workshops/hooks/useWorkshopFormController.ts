import { useState } from "react";
import {
  workshopEventCreateSchema,
  type AppTranslationKey,
  type WorkshopEvent,
  type WorkshopEventCreate,
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
}

const EMPTY: WorkshopFormValues = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  registrationDeadline: "",
  capacity: "",
  fee: "",
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
  };
}

const optionalNumber = (value: string): number | null =>
  value.trim() === "" ? null : Number(value.trim());

/** Form state for the workshop FormModal; saves through `onSave` and closes only on success. */
export function useWorkshopFormController({
  initialData,
  onSave,
  onClose,
}: {
  initialData: WorkshopEvent | null;
  onSave: (input: WorkshopEventCreate) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The page remounts the modal (new `key`) on every open, so initial state is set once here.
  const [values, setValues] = useState<WorkshopFormValues>(() =>
    initialData ? fromWorkshop(initialData) : EMPTY,
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
