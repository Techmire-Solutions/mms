import type React from "react";
import { ShieldCheck } from "lucide-react";
import {
  hedgeRelationshipCreateSchema,
  type Account,
  type AppTranslationKey,
  type HedgeRelationshipCreate,
} from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import { useZodDraftForm } from "@/lib/forms/useZodDraftForm";
import { accountOptions } from "@/tenant/features/accounting/lib/accountOptions";
import {
  emptyHedgeDesignationDraft,
  hedgeDesignationToRecord,
  type HedgeDesignationDraft,
} from "@/tenant/features/accounting/lib/hedgeForms";

interface HedgeDesignationModalProps {
  open: boolean;
  accounts: Account[];
  currencies: string[];
  onClose: () => void;
  onSave: (hedge: HedgeRelationshipCreate) => Promise<void>;
}

type TextField = "name" | "notional" | "contractRate" | "designationRate" | "hedgedItem";

const TEXT_FIELDS: readonly { field: TextField; labelKey: AppTranslationKey; decimal?: boolean }[] =
  [
    { field: "name", labelKey: "accounting.settings.hedges.name" },
    { field: "hedgedItem", labelKey: "accounting.settings.hedges.hedgedItem" },
    { field: "notional", labelKey: "accounting.settings.hedges.notional", decimal: true },
    { field: "contractRate", labelKey: "accounting.settings.hedges.contractRate", decimal: true },
    {
      field: "designationRate",
      labelKey: "accounting.settings.hedges.designationRate",
      decimal: true,
    },
  ];

/** IFRS 9.6.4.1 designation: instrument terms, hedged item, objective and accounts. */
export function HedgeDesignationModal({
  open,
  accounts,
  currencies,
  onClose,
  onSave,
}: HedgeDesignationModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const form = useZodDraftForm<HedgeDesignationDraft, HedgeRelationshipCreate>(
    emptyHedgeDesignationDraft(),
    {
      schema: hedgeRelationshipCreateSchema,
      toRecord: hedgeDesignationToRecord,
      resolveMessage: (message) => t(message as AppTranslationKey),
      saveFailedMessage: "accounting.settings.hedges.createFailed",
    },
  );
  const { draft, errors, updateDraft } = form;
  const handleSave = async () => {
    if (await form.save(onSave)) onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("accounting.settings.hedges.designate")}
      icon={ShieldCheck}
      tall
      error={[...new Set(Object.values(errors))]}
      cancelLabel={t("common.cancel")}
      saveLabel={t("accounting.settings.hedges.designate")}
      onSave={() => void handleSave()}
      saving={form.isSaving}
      formId="hedge-designation-form"
    >
      <form
        id="hedge-designation-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="hedge-type" label={t("accounting.settings.hedges.type")} required>
            <FormSelect
              id="hedge-type"
              name="hedgeType"
              value={draft.hedgeType}
              onChange={(value) =>
                updateDraft({ hedgeType: value === "fair_value" ? "fair_value" : "cash_flow" })
              }
              options={[
                { value: "cash_flow", label: t("accounting.settings.hedges.cashFlow") },
                { value: "fair_value", label: t("accounting.settings.hedges.fairValue") },
              ]}
            />
          </Field>
          <Field id="hedge-direction" label={t("accounting.settings.hedges.direction")} required>
            <FormSelect
              id="hedge-direction"
              name="direction"
              value={draft.direction}
              onChange={(value) => updateDraft({ direction: value === "sell" ? "sell" : "buy" })}
              options={[
                { value: "buy", label: t("accounting.settings.hedges.buy") },
                { value: "sell", label: t("accounting.settings.hedges.sell") },
              ]}
            />
          </Field>
          <Field
            id="hedge-currency"
            label={t("accounting.settings.hedges.currency")}
            required
            error={errors.currency}
          >
            <FormSelect
              id="hedge-currency"
              name="currency"
              value={draft.currency}
              onChange={(value) => updateDraft({ currency: value })}
              placeholder={t("common.selectPlaceholder")}
              options={currencies.map((code) => ({ value: code, label: code }))}
            />
          </Field>
          {TEXT_FIELDS.map(({ field, labelKey, decimal }) => (
            <Field
              key={field}
              id={`hedge-${field}`}
              label={t(labelKey)}
              required
              error={errors[field]}
            >
              <Input
                id={`hedge-${field}`}
                name={field}
                inputMode={decimal ? "decimal" : undefined}
                value={draft[field]}
                onChange={(event) => updateDraft({ [field]: event.target.value })}
              />
            </Field>
          ))}
          <Field
            id="hedge-designation-date"
            label={t("accounting.settings.hedges.designationDate")}
            required
          >
            <DatePicker
              id="hedge-designation-date"
              name="designationDate"
              value={draft.designationDate}
              onChange={(value) => updateDraft({ designationDate: value })}
            />
          </Field>
          <Field
            id="hedge-maturity-date"
            label={t("accounting.settings.hedges.maturityDate")}
            required
            error={errors.maturityDate}
          >
            <DatePicker
              id="hedge-maturity-date"
              name="maturityDate"
              value={draft.maturityDate}
              min={draft.designationDate}
              onChange={(value) => updateDraft({ maturityDate: value })}
            />
          </Field>
          <Field
            id="hedge-instrument-account"
            label={t("accounting.settings.hedges.instrumentAccount")}
            required
            error={errors.instrumentAccountId}
          >
            <FormSelect
              id="hedge-instrument-account"
              name="instrumentAccountId"
              value={draft.instrumentAccountId}
              onChange={(value) => updateDraft({ instrumentAccountId: value })}
              placeholder={t("accounting.journal.form.selectAccount")}
              options={accountOptions(accounts, ["Asset", "Liability"])}
            />
          </Field>
          {draft.hedgeType === "cash_flow" && (
            <Field
              id="hedge-reserve-account"
              label={t("accounting.settings.hedges.reserveAccount")}
              required
              error={errors.reserveAccountId}
            >
              <FormSelect
                id="hedge-reserve-account"
                name="reserveAccountId"
                value={draft.reserveAccountId}
                onChange={(value) => updateDraft({ reserveAccountId: value })}
                placeholder={t("accounting.journal.form.selectAccount")}
                options={accountOptions(accounts, "Equity")}
              />
            </Field>
          )}
          <Field
            id="hedge-pnl-account"
            label={t("accounting.settings.hedges.pnlAccount")}
            required
            error={errors.pnlAccountId}
          >
            <FormSelect
              id="hedge-pnl-account"
              name="pnlAccountId"
              value={draft.pnlAccountId}
              onChange={(value) => updateDraft({ pnlAccountId: value })}
              placeholder={t("accounting.journal.form.selectAccount")}
              options={accountOptions(accounts, ["Revenue", "Expense"])}
            />
          </Field>
        </div>
        <Field
          id="hedge-objective"
          label={t("accounting.settings.hedges.objective")}
          hint={t("accounting.settings.hedges.objectiveHint")}
          required
          error={errors.riskManagementObjective}
        >
          <Textarea
            id="hedge-objective"
            name="riskManagementObjective"
            value={draft.riskManagementObjective}
            onChange={(event) => updateDraft({ riskManagementObjective: event.target.value })}
          />
        </Field>
      </form>
    </FormModal>
  );
}
