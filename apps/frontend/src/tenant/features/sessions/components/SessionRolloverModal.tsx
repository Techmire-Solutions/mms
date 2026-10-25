import React from "react";
import { CopyPlus } from "lucide-react";
import type { AppTranslationKey, Session } from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { DatePicker } from "@/components/app/DatePicker";
import { Alert } from "@/components/app/Alert";
import { Input } from "@/components/ui/input";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionRolloverActions } from "@/tenant/features/sessions/hooks/useSessionRollover";
import {
  useSessionRolloverForm,
  type RolloverCopyKey,
  type RolloverMode,
} from "@/tenant/features/sessions/hooks/useSessionRolloverForm";
import { SessionRolloverPromotionFields } from "./SessionRolloverPromotionFields";

const COPY_LABEL: Record<RolloverCopyKey, AppTranslationKey> = {
  fees: "sessions.rollover.copy.fees",
  discounts: "sessions.rollover.copy.discounts",
  scholarships: "sessions.rollover.copy.scholarships",
  workingDays: "sessions.rollover.copy.workingDays",
  staff: "sessions.rollover.copy.staff",
  calendar: "sessions.rollover.copy.calendar",
};

/**
 * Duplicate a session's structure, or promote its students, into a new draft session.
 * Mount it only while open so each opening starts from fresh state.
 */
export function SessionRolloverModal({
  session,
  open,
  canPromote,
  onClose,
}: {
  session: Session;
  open: boolean;
  canPromote: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const form = useSessionRolloverForm(session, canPromote ? "promote" : "duplicate");
  const { preview, start, isPending } = useSessionRolloverActions();

  const id = String(session.id);
  const runPreview = async () => {
    const rows = await preview(id, form.body);
    if (rows) form.setPreview(rows);
  };
  const submit = async () => {
    if (await start(id, form.body)) onClose();
  };
  const promote = form.mode === "promote";

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("sessions.rollover.title", { session: session.name })}
      icon={CopyPlus}
      size="lg"
      cancelLabel={t("common.cancel")}
      saveLabel={
        promote ? t("sessions.rollover.startPromote") : t("sessions.rollover.startDuplicate")
      }
      saving={isPending}
      saveDisabled={isPending || !form.valid || (promote && form.preview === null)}
      isDirty={form.isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void submit()}
    >
      <div className="space-y-4 py-1 text-start">
        <Alert
          density="compact"
          description={
            promote ? t("sessions.rollover.promoteHint") : t("sessions.rollover.duplicateHint")
          }
        />
        <Field id="rollover-mode" label={t("sessions.rollover.mode")} required>
          <FormSelect
            id="rollover-mode"
            name="mode"
            value={form.mode}
            disabled={isPending}
            onChange={(value) => form.setMode(value === "promote" ? "promote" : "duplicate")}
            options={(["duplicate", "promote"] as const satisfies readonly RolloverMode[])
              .filter((mode) => mode === "duplicate" || canPromote)
              .map((mode) => ({ value: mode, label: t(`sessions.rollover.mode.${mode}`) }))}
          />
        </Field>
        <Field id="rollover-name" label={t("sessions.rollover.name")} required>
          <Input
            id="rollover-name"
            name="name"
            className={FORM_INPUT}
            value={form.name}
            maxLength={200}
            disabled={isPending}
            onChange={(event) => form.setName(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rollover-start" label={t("sessions.rollover.startDate")} required>
            <DatePicker
              id="rollover-start"
              name="startDate"
              value={form.dates.startDate}
              disabled={isPending}
              onChange={form.setStartDate}
            />
          </Field>
          <Field
            id="rollover-end"
            label={t("sessions.rollover.endDate")}
            error={
              form.dates.endDate && !form.datesValid
                ? t("sessions.rollover.endBeforeStart")
                : undefined
            }
            required
          >
            <DatePicker
              id="rollover-end"
              name="endDate"
              value={form.dates.endDate}
              min={form.dates.startDate || undefined}
              disabled={isPending}
              onChange={form.setEndDate}
            />
          </Field>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">
            {t("sessions.rollover.copyLegend")}
          </legend>
          {(Object.keys(COPY_LABEL) as RolloverCopyKey[]).map((key) => (
            <FormCheckboxCard
              key={key}
              id={`rollover-copy-${key}`}
              name={`copy-${key}`}
              label={t(COPY_LABEL[key])}
              checked={form.copy[key]}
              disabled={isPending}
              onCheckedChange={(checked) => form.toggleCopy(key, checked)}
            />
          ))}
        </fieldset>
        {promote ? (
          <SessionRolloverPromotionFields
            session={session}
            form={form}
            disabled={isPending || !form.valid}
            onPreview={() => void runPreview()}
          />
        ) : null}
      </div>
    </FormModal>
  );
}
