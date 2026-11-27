import React, { useState } from "react";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { useTranslation } from "@mms/fe-core/i18n";
import { Input } from "@mms/ui";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import type { Mujtahid, MujtahidRep } from "../lib/mujtahidManagerTypes";

export interface MujtahidNameFormModalProps {
  title: string;
  initial: Partial<Mujtahid> | Partial<MujtahidRep>;
  onSave: (form: Partial<Mujtahid> | Partial<MujtahidRep>) => Promise<unknown> | void;
  onClose: () => void;
  label: string;
}

export type NameFormModalProps = MujtahidNameFormModalProps;

export function MujtahidNameFormModal({
  initial,
  onSave,
  onClose,
  label,
  title,
}: MujtahidNameFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...initial });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { isDirty } = useDirtySnapshot(form, `true:${initial.id ?? "new"}`, { ...initial });

  const handleSave = async (): Promise<void> => {
    if (!form.name || !form.name.trim()) {
      setError(t("obligations.mujtahids.nameRequired"));
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("obligations.saveFailed"));
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
      saveDisabled={saving}
      error={error || undefined}
      formId="name-form-modal"
    >
      <form
        id="name-form-modal"
        noValidate
        onSubmit={(event: any) => {
          event.preventDefault();
          if (!saving) void handleSave();
        }}
      >
        <Field id="name-form-input" label={label} required error={error || undefined}>
          <Input
            id="name-form-input"
            name="name"
            value={form.name || ""}
            onChange={(event: any) => {
              if (error) setError("");
              setForm({ ...form, name: event.target.value });
            }}
            disabled={saving}
            required
            autoFocus
          />
        </Field>
      </form>
    </FormModal>
  );
}

/** Backward-compatibility alias */
export const NameFormModal = MujtahidNameFormModal;
