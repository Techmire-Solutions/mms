import { useState } from "react";
import { DESIGNATED_FOR_OPTIONS } from "@/lib/data/obligationsData";
import { FormModal } from "@/components/ui/FormModal";
import { Field } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppTranslationKey } from "@mms/shared";
import type { ObligationType } from "@/lib/data/obligationsData";
import {
  DESIGNATED_LABEL_KEYS,
  type DesignatedFor,
} from "@/tenant/features/obligations/components/obligationTypeManagerShared";

interface ObligationTypeFormModalProps {
  title: string;
  initial: Partial<ObligationType>;
  onSave: (form: Partial<ObligationType>) => Promise<unknown> | void;
  onClose: () => void;
}

export function ObligationTypeFormModal({
  initial,
  onSave,
  onClose,
  title,
}: ObligationTypeFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...initial });
  const [errors, setErrors] = useState<Partial<Record<"name", AppTranslationKey>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const designatedOptions = (() =>
    DESIGNATED_FOR_OPTIONS.map((option) => ({
      value: option,
      label: t(DESIGNATED_LABEL_KEYS[option as DesignatedFor]),
    })))();

  const validate = (): Partial<Record<"name", AppTranslationKey>> => {
    const nextErrors: Partial<Record<"name", AppTranslationKey>> = {};
    if (!form.name?.trim()) nextErrors.name = "obligations.types.nameRequired";
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
      await onSave(form);
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
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={saving || !form.name?.trim()}
      error={submitError || undefined}
      formId="obligation-type-form-modal"
    >
      <form
        id="obligation-type-form-modal"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && form.name?.trim()) void handleSave();
        }}
        className="space-y-4"
      >
        <Field
          id="type-name"
          label={t("obligations.types.colName")}
          required
          error={errors.name ? t(errors.name) : undefined}
        >
          <Input
            id="type-name"
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
        <Field id="type-designated" label={t("obligations.types.colDesignated")} required>
          <FormSelect
            id="type-designated"
            name="designated_for"
            value={form.designated_for || ""}
            onChange={(val) => setForm({ ...form, designated_for: val as DesignatedFor })}
            options={designatedOptions}
          />
        </Field>
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox
            id="qty"
            name="quantity_based"
            checked={form.quantity_based}
            onCheckedChange={(checked) => setForm({ ...form, quantity_based: !!checked })}
          />
          <label
            htmlFor="qty"
            className="text-sm font-medium text-foreground cursor-pointer select-none"
          >
            {t("obligations.types.colQuantity")}
          </label>
        </div>
      </form>
    </FormModal>
  );
}
