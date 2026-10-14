import React, { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  ACCOUNT_SUBTYPES,
  ACCOUNT_TYPE_META,
  type Account,
  type AccountType,
} from "@/lib/data/accountingData";
import { useAccountingConfig } from "@/hooks/useStandardModuleConfig";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { accountRecordSchema, generateClientEntityId, type AppTranslationKey } from "@mms/shared";
import { createZodFormResolver } from "@/lib/forms/createZodFormResolver";
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
  const [submitting, setSubmitting] = useState(false);
  const { fields, orderedFields, isFieldEnabled } = useAccountingConfig();

  const [defaultValues] = useState<Account>(
    () =>
      ({
        ...(initial ?? {}),
        id: initial?.id ?? generateClientEntityId("a"),
        code: initial?.code ?? "",
        name: initial?.name ?? "",
        type: initial?.type ?? "Asset",
        subtype: initial?.subtype ?? "",
        description: initial?.description ?? "",
        isActive: initial?.isActive ?? true,
      }) as Account,
  );

  // Shared validation contract: the resolver emits the same ValidationError[] shape as the
  // hand-rolled forms; field messages are already translated via `resolveMessage`.
  const resolver = useMemo(
    () =>
      createZodFormResolver(accountRecordSchema, {
        resolveMessage: (message) => t(message as AppTranslationKey),
      }),
    [t],
  );

  const { watch, setValue, setError, handleSubmit, formState } = useForm<Account>({
    resolver,
    defaultValues,
    mode: "onSubmit",
  });

  const form = watch();
  const type = form.type as AccountType;
  const subtypes = type ? ACCOUNT_SUBTYPES[type] || [] : [];

  const errors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(formState.errors)) {
      const message = (value as { message?: unknown } | undefined)?.message;
      if (typeof message === "string") map[key] = message;
    }
    return map;
  }, [formState.errors]);

  const updateField = (key: keyof Account, value: unknown) => {
    setValue(key, value as never, { shouldDirty: true, shouldValidate: false });
  };

  const onTypeChange = (newType: AccountType) => {
    setValue("type", newType as never, { shouldDirty: true });
    setValue("subtype", "" as never, { shouldDirty: true });
  };

  const onValid = async (data: Account) => {
    let hasExtraError = false;

    if (!isEdit && existingCodes.includes(data.code.trim())) {
      setError("code", { type: "manual", message: t("accounting.coa.validation.codeExists") });
      hasExtraError = true;
    }
    for (const field of orderedFields) {
      const value = (data as Record<string, unknown>)[field.id];
      if (fields[field.id]?.required && !String(value ?? "").trim()) {
        setError(field.id as keyof Account, {
          type: "manual",
          message: t("common.formPleaseFixErrors"),
        });
        hasExtraError = true;
      }
    }
    if (hasExtraError) return;

    setSubmitting(true);
    try {
      await onSave(data);
    } finally {
      setSubmitting(false);
    }
  };

  const saveAccount = () => handleSubmit(onValid)();
  const errorMessages = Object.values(errors).filter(Boolean);

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
