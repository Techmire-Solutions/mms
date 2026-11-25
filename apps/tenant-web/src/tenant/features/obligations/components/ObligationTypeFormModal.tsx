import { useState } from "react";
import { DESIGNATED_FOR_OPTIONS } from "@/lib/data/obligationsData";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { useTranslation } from "@mms/fe-core/i18n";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { FORM_INPUT } from "@mms/ui";
import { Input } from "@mms/ui";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { CheckboxField } from "@mms/ui";
import { obligationTypeInsertSchema } from "@mms/contracts";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import type { ObligationType } from "@/lib/data/obligationsData";
import {
  DESIGNATED_LABEL_KEYS,
  type DesignatedFor,
} from "@/tenant/features/obligations/lib/obligationTypeManagerShared";

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { isDirty } = useDirtySnapshot(form, `true:${initial.id ?? "new"}`, { ...initial });

  const designatedOptions = (() =>
    DESIGNATED_FOR_OPTIONS.map((option) => ({
      value: option,
      label: t(DESIGNATED_LABEL_KEYS[option as DesignatedFor]),
    })))();

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {};
    if (!form.name?.trim()) nextErrors.name = t("obligations.types.nameRequired");
    if (!form.designated_for) {
      nextErrors.designated_for = t("common.fieldRequired", {
        field: t("obligations.types.colDesignated"),
      });
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
    const parsed = obligationTypeInsertSchema.safeParse({
      ...(form.id ? { id: String(form.id) } : {}),
      name: form.name?.trim() ?? "",
      quantity_based: Boolean(form.quantity_based),
      designated_for: form.designated_for,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? "name"), issue.message]),
        ),
      );
      setSubmitError(t("common.formPleaseFixErrors"));
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, ...parsed.data });
    } catch (err: unknown) {
      setSubmitError(mapApiFormError(err).message ?? t("obligations.saveFailed"));
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
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
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
        <Field id="type-name" label={t("obligations.types.colName")} required error={errors.name}>
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
        <Field
          id="type-designated"
          label={t("obligations.types.colDesignated")}
          required
          error={errors.designated_for}
        >
          <FormSelect
            id="type-designated"
            name="designated_for"
            value={form.designated_for || ""}
            onChange={(val) => {
              setForm({ ...form, designated_for: val as DesignatedFor });
              if (errors.designated_for) {
                setErrors((prev) => ({ ...prev, designated_for: "" }));
              }
            }}
            options={designatedOptions}
          />
        </Field>
        <CheckboxField
          id="qty"
          name="quantity_based"
          checked={Boolean(form.quantity_based)}
          onCheckedChange={(checked) => setForm({ ...form, quantity_based: checked })}
          label={t("obligations.types.colQuantity")}
        />
      </form>
    </FormModal>
  );
}
