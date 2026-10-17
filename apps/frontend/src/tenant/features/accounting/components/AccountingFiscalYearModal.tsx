import React, { useState } from "react";
import { Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/app/DatePicker";
import { FormModal } from "@/components/app/FormModal";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";
import { generateClientEntityId } from "@mms/shared";
import type { FiscalYear } from "@/lib/data/accountingData";

interface AccountingFiscalYearModalProps {
  open: boolean;
  initial: Partial<FiscalYear> | null;
  onSave: (fiscalYear: FiscalYear) => void | Promise<void>;
  onClose: () => void;
  /**
   * Hands off to the confirmed close flow. `closed` is never a status option in
   * this form, so an existing open year offers this entry point instead.
   */
  onRequestClose?: (fiscalYearId: string) => void;
}

const blankFiscalYear: Partial<FiscalYear> = {
  label: "",
  startDate: "",
  endDate: "",
  status: "upcoming",
};

export function AccountingFiscalYearModal({
  open,
  initial,
  onSave,
  onClose,
  onRequestClose,
}: AccountingFiscalYearModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  /**
   * A closed year is immutable where it matters: the server rejects reopening
   * it, rejects a date-range change and rejects writing `closed` through the
   * bulk route. `closed` is therefore not an option here — only the close
   * action may set it — and the date range is locked once the year is closed.
   */
  const isClosed = initial?.status === "closed";
  const [form, setForm] = useState<Partial<FiscalYear>>(initial || blankFiscalYear);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(initial || blankFiscalYear);
      setErrors({});
    }
  }, [open, initial]);

  const validate = () => {
    const validationErrors: Record<string, string> = {};
    if (!form.label?.trim()) validationErrors.label = t("accounting.settings.fy.validation.label");
    if (!form.startDate)
      validationErrors.startDate = t("accounting.settings.fy.validation.startDate");
    if (!form.endDate) validationErrors.endDate = t("accounting.settings.fy.validation.endDate");
    if (form.startDate && form.endDate && form.startDate >= form.endDate)
      validationErrors.endDate = t("accounting.settings.fy.validation.endAfterStart");
    return validationErrors;
  };

  const updateFormField = <K extends keyof FiscalYear>(key: K, value: FiscalYear[K] | string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        // A closed year keeps the status the server already stored; sending any
        // other value is rejected outright.
        status: isClosed ? "closed" : (form.status ?? "upcoming"),
        id: isEdit ? form.id : generateClientEntityId("fy"),
      } as FiscalYear);
    } catch (error) {
      // Surface what the server actually said (closed-year guards, overlapping
      // ranges, …) instead of a generic "failed to save".
      setErrors((prev) => ({
        ...prev,
        form: accountingErrorMessage(error) ?? t("accounting.settings.fy.saveFailed"),
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? t("accounting.settings.fy.editTitle") : t("accounting.settings.fy.newTitle")}
      icon={Calendar}
      error={Object.values(errors)}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={submitting}
      formId="fiscal-year-modal-form"
    >
      <form
        id="fiscal-year-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className="space-y-4"
      >
        <Field
          id="financial-year-label"
          label={t("accounting.settings.fy.labelField")}
          required
          error={errors.label}
        >
          <Input
            id="financial-year-label"
            name="label"
            value={form.label || ""}
            onChange={(event) => updateFormField("label", event.target.value)}
            placeholder={t("accounting.settings.fy.labelPlaceholder")}
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="financial-year-start"
            label={t("accounting.settings.fy.startDateField")}
            required
            error={errors.startDate}
          >
            <DatePicker
              id="financial-year-start"
              name="startDate"
              value={form.startDate || ""}
              onChange={(startDateValue) => updateFormField("startDate", startDateValue)}
              max={form.endDate || undefined}
              disabled={isClosed}
              required
            />
          </Field>
          <Field
            id="financial-year-end"
            label={t("accounting.settings.fy.endDateField")}
            required
            error={errors.endDate}
          >
            <DatePicker
              id="financial-year-end"
              name="endDate"
              value={form.endDate || ""}
              onChange={(endDateValue) => updateFormField("endDate", endDateValue)}
              min={form.startDate || undefined}
              disabled={isClosed}
              required
            />
          </Field>
        </div>
        <Field
          id="financial-year-status"
          label={t("accounting.settings.fy.status")}
          error={errors.status}
          hint={
            isClosed
              ? t("accounting.settings.fy.closedLockedHint")
              : isEdit && onRequestClose
                ? t("accounting.settings.fy.closeHint")
                : undefined
          }
        >
          <FormSelect
            id="financial-year-status"
            name="status"
            value={isClosed ? "closed" : form.status || "upcoming"}
            disabled={isClosed}
            onChange={(statusValue) =>
              updateFormField("status", statusValue as FiscalYear["status"] | "upcoming")
            }
            options={
              isClosed
                ? [{ value: "closed", label: t("accounting.settings.fy.status.closed") }]
                : [
                    { value: "upcoming", label: t("accounting.settings.fy.status.upcoming") },
                    { value: "active", label: t("accounting.settings.fy.status.active") },
                  ]
            }
          />
        </Field>
        {isEdit && !isClosed && onRequestClose && initial?.id && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRequestClose(initial.id as string)}
            className="min-h-11 gap-1.5"
          >
            <Lock className="size-4" aria-hidden="true" />
            {t("accounting.settings.fy.close")}
          </Button>
        )}
      </form>
    </FormModal>
  );
}
