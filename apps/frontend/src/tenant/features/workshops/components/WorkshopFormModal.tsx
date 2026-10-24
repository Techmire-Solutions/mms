import React from "react";
import type { WorkshopEvent, WorkshopEventCreate } from "@mms/shared";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { DatePicker } from "@/components/app/DatePicker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkshopFormController } from "../hooks/useWorkshopFormController";

export interface WorkshopFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData: WorkshopEvent | null;
  onSave: (input: WorkshopEventCreate) => Promise<void>;
}

export function WorkshopFormModal({
  open,
  onClose,
  initialData,
  onSave,
}: WorkshopFormModalProps): React.JSX.Element {
  const { t, values, setField, error, saving, isDirty, handleSubmit } = useWorkshopFormController({
    initialData,
    onSave,
    onClose,
  });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={initialData ? t("workshops.edit") : t("workshops.create")}
      error={error ?? undefined}
      saving={saving}
      isDirty={isDirty}
      onSave={handleSubmit}
    >
      <div className="space-y-4 py-2">
        <Field id="workshop-title" label={t("workshops.title")} required>
          <Input
            id="workshop-title"
            name="title"
            value={values.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder={t("workshops.titlePlaceholder")}
          />
        </Field>

        <Field id="workshop-description" label={t("workshops.description")}>
          <Textarea
            id="workshop-description"
            name="description"
            rows={3}
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="workshop-start-date" label={t("workshops.startDate")}>
            <DatePicker
              id="workshop-start-date"
              name="startDate"
              value={values.startDate}
              onChange={(v) => setField("startDate", v ?? "")}
            />
          </Field>
          <Field id="workshop-end-date" label={t("workshops.endDate")}>
            <DatePicker
              id="workshop-end-date"
              name="endDate"
              value={values.endDate}
              onChange={(v) => setField("endDate", v ?? "")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="workshop-deadline" label={t("workshops.registrationDeadline")}>
            <DatePicker
              id="workshop-deadline"
              name="registrationDeadline"
              value={values.registrationDeadline}
              onChange={(v) => setField("registrationDeadline", v ?? "")}
            />
          </Field>
          <Field id="workshop-capacity" label={t("workshops.capacity")}>
            <Input
              id="workshop-capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={values.capacity}
              onChange={(e) => setField("capacity", e.target.value)}
              placeholder={t("workshops.unlimited")}
            />
          </Field>
          <Field id="workshop-fee" label={t("workshops.fee")}>
            <Input
              id="workshop-fee"
              name="fee"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={values.fee}
              onChange={(e) => setField("fee", e.target.value)}
              placeholder={t("workshops.free")}
            />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}
