import React, { useState } from "react";
import { PieChart } from "lucide-react";
import { FormSelect } from "@/components/ui/FormSelect";
import { FormModal } from "@/components/ui/FormModal";
import { Field } from "@/components/ui/FormPrimitives";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { DISTRIBUTION_TYPES, type ObligationDistribution } from "@/lib/data/obligationsData";
import { type DistributionType } from "@/tenant/features/obligations/components/WakalaTypeManager";

interface DistributionFormModalProps {
  title: string;
  initial: Partial<ObligationDistribution>;
  onSave: (form: Partial<ObligationDistribution>) => Promise<unknown> | void;
  onClose: () => void;
}

export function DistributionFormModal({
  initial,
  onSave,
  onClose,
  title,
}: DistributionFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {};
    if (!form.name?.trim()) nextErrors.name = t("obligations.mujtahids.nameRequired");
    if (
      !form.percentage ||
      isNaN(Number(form.percentage)) ||
      Number(form.percentage) <= 0 ||
      Number(form.percentage) > 100
    ) {
      nextErrors.pct = t("obligations.wakala.pctInvalid");
    }
    return nextErrors;
  };

  const handleSave = async (): Promise<void> => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSubmitError("");
    setSaving(true);
    try {
      await onSave({ ...form, percentage: Number(form.percentage) });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t("obligations.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={title}
      icon={PieChart}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={saving || !form.name?.trim() || !form.percentage}
      error={submitError || undefined}
      formId="distribution-form-modal"
    >
      <form
        id="distribution-form-modal"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && form.name?.trim() && form.percentage) void handleSave();
        }}
        className="space-y-4 text-start"
      >
        <Field id="dist-name" label={t("obligations.wakala.distName")} required error={errors.name}>
          <Input
            id="dist-name"
            name="name"
            value={form.name || ""}
            onChange={(event) => {
              if (errors.name) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }
              setForm({ ...form, name: event.target.value });
            }}
            className={FORM_INPUT}
          />
        </Field>
        <Field id="dist-type" label={t("obligations.wakala.distType")} required>
          <FormSelect
            id="dist-type"
            name="type"
            value={form.type || ""}
            onChange={(val) => setForm({ ...form, type: val as DistributionType })}
            options={DISTRIBUTION_TYPES.map((type) => ({
              value: type,
              label:
                type === "Income"
                  ? t("obligations.distribution.income")
                  : t("obligations.distribution.liability"),
            }))}
          />
        </Field>
        <Field id="dist-pct" label={t("obligations.wakala.distPct")} required error={errors.pct}>
          <Input
            id="dist-pct"
            name="percentage"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={
              form.percentage === undefined || form.percentage === null
                ? ""
                : String(form.percentage)
            }
            onChange={(event) => {
              if (errors.pct) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.pct;
                  return next;
                });
              }
              const val = event.target.value;
              if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                setForm({
                  ...form,
                  percentage: val === "" ? ("" as unknown as number) : parseFloat(val) || 0,
                });
              }
            }}
            className={FORM_INPUT}
          />
        </Field>
      </form>
    </FormModal>
  );
}
