import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import {
  ACCOUNT_SUBTYPES,
  ACCOUNT_TYPE_META,
  type Account,
  type AccountType,
} from "@/lib/data/accountingData";
import { useAccountingConfig } from "@/hooks/useStandardModuleConfig";
import { FormModal } from "@/components/ui/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { accountRecordSchema, generateClientEntityId, type AppTranslationKey } from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { AccountModalFields } from "@/tenant/features/accounting/components/AccountModalFields";

interface AccountModalProps {
  initial: Account | null;
  onSave: (account: Account) => void | Promise<void>;
  onClose: () => void;
  existingCodes: string[];
}

export function AccountModal({ initial, onSave, onClose, existingCodes }: AccountModalProps) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Partial<Account>>(
    initial || { code: "", name: "", type: "Asset", subtype: "", description: "", isActive: true },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const type = form.type as AccountType;
  const subtypes = type ? ACCOUNT_SUBTYPES[type] || [] : [];
  const { fields, orderedFields, isFieldEnabled } = useAccountingConfig();

  const updateField = (key: keyof Account, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const onTypeChange = (newType: AccountType) => {
    setForm((prev) => ({ ...prev, type: newType, subtype: "" }));
    if (errors.type || errors.subtype) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.type;
        delete next.subtype;
        return next;
      });
    }
  };

  const saveAccount = async () => {
    const candidate = {
      ...form,
      id: isEdit ? form.id : generateClientEntityId("a"),
      code: form.code?.trim() ?? "",
      name: form.name?.trim() ?? "",
      type: form.type ?? "Asset",
      subtype: form.subtype ?? "",
      description: form.description ?? "",
      isActive: form.isActive ?? true,
    };
    const parsed = accountRecordSchema.safeParse(candidate);
    const validationErrors = parsed.success
      ? {}
      : mapZodFormErrors(parsed.error, (message) => t(message as AppTranslationKey));

    if (!isEdit && existingCodes.includes(candidate.code)) {
      validationErrors.code = t("accounting.coa.validation.codeExists");
    }
    for (const field of orderedFields) {
      const candidateValue = (candidate as Record<string, unknown>)[field.id];
      if (fields[field.id]?.required && !String(candidateValue ?? "").trim()) {
        validationErrors[field.id] = t("common.formPleaseFixErrors");
      }
    }

    if (!parsed.success || Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSave(parsed.data as Account);
    } finally {
      setSubmitting(false);
    }
  };

  const errorMessages = (() => Object.values(errors).filter(Boolean))();

  return (
    <FormModal
      open
      onClose={onClose}
      title={isEdit ? t("accounting.coa.editAccount") : t("accounting.coa.addAccount")}
      icon={BookOpen}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={saveAccount}
      saving={submitting}
      error={errorMessages}
      formId="account-modal-form"
    >
      <form
        id="account-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void saveAccount();
        }}
      >
        <AccountModalFields
          orderedFields={orderedFields}
          fields={fields}
          isFieldEnabled={isFieldEnabled}
          form={form}
          errors={errors}
          updateField={updateField}
          onTypeChange={onTypeChange}
          subtypes={subtypes}
          t={t}
        />
      </form>

      {type && ACCOUNT_TYPE_META[type] && (
        <div
          className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${ACCOUNT_TYPE_META[type].color}`}
          aria-live="polite"
        >
          <span aria-hidden="true">{ACCOUNT_TYPE_META[type].icon}</span>
          <span>
            {t(`accounting.type.${type}` as AppTranslationKey)} ·{" "}
            {t("accounting.columns.account.normalBalance")}:{" "}
            <strong>
              {ACCOUNT_TYPE_META[type].normalBalance === "debit"
                ? t("accounting.ledger.dr")
                : t("accounting.ledger.cr")}
            </strong>{" "}
            · {t(`accounting.reports.views.${ACCOUNT_TYPE_META[type].group}` as AppTranslationKey)}
          </span>
        </div>
      )}
    </FormModal>
  );
}
