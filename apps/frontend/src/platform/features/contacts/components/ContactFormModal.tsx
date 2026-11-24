import React, { useState } from "react";
import { Input } from "@shared/ui";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import type { PlatformContactDto } from "@mms/shared";
import {
  PLATFORM_CONTACT_KINDS,
  PLATFORM_CONTACT_KIND_LABEL_KEYS,
  type PlatformContactKind,
} from "@/platform/features/contacts/lib/platformContactKinds";

export interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  kind: PlatformContactDto["kind"];
  notes: string;
}

const EMPTY_FORM: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  kind: "external",
  notes: "",
};

/** Create/edit platform contact (shared FormModal lifecycle). */
export function ContactFormModal({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: PlatformContactDto | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: ContactFormState) => Promise<void>;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [form, setForm] = useState<ContactFormState>(
    initial
      ? {
          name: initial.name,
          email: initial.email ?? "",
          phone: initial.phone ?? "",
          kind: initial.kind,
          notes: initial.notes ?? "",
        }
      : EMPTY_FORM,
  );

  return (
    <FormModal
      open
      onClose={onClose}
      title={initial ? t("platform.contacts.edit") : t("platform.contacts.add")}
      saveLabel={t("common.save")}
      onSave={() => onSave(form)}
      isDirty={true}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("settings.unsavedChanges")}
      saving={saving}
    >
      <div className="space-y-4">
        <Field id="c-name" label={t("platform.contacts.name")}>
          <Input
            id="c-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field id="c-email" label={t("platform.contacts.email")}>
          <Input
            id="c-email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field id="c-phone" label={t("platform.contacts.phone")}>
          <Input
            id="c-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field id="c-kind" label={t("platform.contacts.kind")}>
          <FormSelect
            id="c-kind"
            name="kind"
            value={form.kind}
            onChange={(value) => setForm({ ...form, kind: value as PlatformContactKind })}
            options={PLATFORM_CONTACT_KINDS.map((o) => ({
              value: o,
              label: t(PLATFORM_CONTACT_KIND_LABEL_KEYS[o]),
            }))}
          />
        </Field>
        <Field id="c-notes" label={t("platform.contacts.notes")}>
          <Input
            id="c-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}
