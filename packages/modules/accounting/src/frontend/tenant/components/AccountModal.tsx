import {
  translateApiMessage,
  translateValidationMessage,
} from "@mms/fe-core/forms/translateValidationMessage";
import React, { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { ACCOUNT_SUBTYPES, ACCOUNT_TYPE_META, type Account, type AccountType } from "../index";
import { useAccountingConfig } from "../host/useStandardModuleConfig";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  accountRecordSchema,
  generateClientEntityId,
  type AppTranslationKey,
} from "@mms/contracts";
import { createZodFormResolver } from "@mms/fe-core/forms/createZodFormResolver";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";
import { AccountModalFields } from "./AccountModalFields";

interface AccountModalProps {
  initial: Account | null;
  onSave: (account: Account) => void | Promise<void>;
  onClose: () => void;
  existingCodes: string[];
}

/** Field ids ↔ the same translation keys AccountModalFields renders. */
const ACCOUNT_FIELD_LABEL_KEYS: Partial<Record<string, AppTranslationKey>> = {
  code: "accounting.coa.fields.code",
  type: "accounting.coa.fields.type",
  name: "accounting.coa.fields.name",
  subtype: "accounting.coa.fields.subtype",
  description: "accounting.coa.fields.description",
};

function buildAccountDefaults(initial: Account | null): Account {
  return {
    ...(initial ?? {}),
    // `||`, not `??`: the add flow passes `id: ""`, and the bulk upsert drops id-less rows.
    id: initial?.id || generateClientEntityId("a"),
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    type: initial?.type ?? "Asset",
    subtype: initial?.subtype ?? "",
    description: initial?.description ?? "",
    isActive: initial?.isActive ?? true,
  } as Account;
}

export function AccountModal({ initial, onSave, onClose, existingCodes }: AccountModalProps) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const guard = useSubmitGuard();
  const { fields, orderedFields, isFieldEnabled } = useAccountingConfig();

  const [defaultValues] = useState<Account>(() => buildAccountDefaults(initial));

  // Shared validation contract: the resolver emits the same ValidationError[] shape as the
  // hand-rolled forms; field messages are already translated via `resolveMessage`.
  const resolver = useMemo(
    () =>
      createZodFormResolver(accountRecordSchema, {
        resolveMessage: (message) => translateValidationMessage(message, t),
      }),
    [t],
  );

  const { control, setValue, setError, handleSubmit, formState, reset } = useForm<Account>({
    resolver,
    defaultValues,
    mode: "onSubmit",
  });

  // Switching the edited account (or edit → create) while the modal stays mounted
  // must not keep the previous record's values.
  useIdentityReset(String(initial?.id ?? "new"), () => {
    reset(buildAccountDefaults(initial));
    setServerError(null);
  });

  // `useWatch` subscribes to the whole form reactively; RHF's `useForm().watch()`
  // returns a function the React Compiler cannot memoize (stale-UI risk), so the
  // subscription form is used instead of disabling the compiler for the component.
  const form = useWatch({ control });
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
    setServerError(null);
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
          message: t("common.fieldRequired", {
            field: ACCOUNT_FIELD_LABEL_KEYS[field.id]
              ? t(ACCOUNT_FIELD_LABEL_KEYS[field.id]!)
              : field.id,
          }),
        });
        hasExtraError = true;
      }
    }
    if (hasExtraError) return;

    await guard(async () => {
      setSubmitting(true);
      try {
        await onSave(data);
      } catch (error) {
        const mapped = mapApiFormError(error, (message) => translateApiMessage(message, t));
        if (mapped.fieldErrors) {
          for (const [field, message] of Object.entries(mapped.fieldErrors)) {
            setError(field as keyof Account, { type: "manual", message });
          }
        }
        setServerError(mapped.message ?? t("common.formPleaseFixErrors"));
      } finally {
        setSubmitting(false);
      }
    });
  };

  const saveAccount = () => handleSubmit(onValid)();
  const errorMessages = [
    ...Object.values(errors).filter(Boolean),
    ...(serverError ? [serverError] : []),
  ];

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
