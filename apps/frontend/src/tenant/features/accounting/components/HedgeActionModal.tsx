import type React from "react";
import { useState } from "react";
import { HandCoins } from "lucide-react";
import { todayISO, type Account, type HedgeRelationship } from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { accountOptions } from "@/tenant/features/accounting/lib/accountOptions";
import type { HedgeAction, HedgeActionInput } from "@/tenant/features/accounting/lib/hedgeForms";

interface HedgeActionModalProps {
  action: HedgeAction;
  hedge: HedgeRelationship;
  accounts: Account[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: HedgeActionInput) => Promise<void>;
}

/** Cash settlement of the forward, or reclassification of the settled reserve into profit or loss. */
export function HedgeActionModal({
  action,
  hedge,
  accounts,
  saving,
  onClose,
  onSave,
}: HedgeActionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [input, setInput] = useState<HedgeActionInput>({
    date: todayISO(),
    rate: "",
    accountId: "",
  });
  const settle = action === "settle";
  const complete = input.date && input.accountId && (!settle || input.rate.trim());
  const submit = () => {
    if (complete) void onSave({ ...input, rate: input.rate.trim() });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={t(
        settle ? "accounting.settings.hedges.settle" : "accounting.settings.hedges.reclassify",
      )}
      subtitle={hedge.name}
      icon={HandCoins}
      cancelLabel={t("common.cancel")}
      saveLabel={t(
        settle ? "accounting.settings.hedges.settle" : "accounting.settings.hedges.reclassify",
      )}
      onSave={submit}
      saving={saving}
      formId="hedge-action-form"
    >
      <form
        id="hedge-action-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <p className="m-0 text-xs text-muted-foreground text-pretty">
          {t(
            settle
              ? "accounting.settings.hedges.settleHint"
              : "accounting.settings.hedges.reclassifyHint",
          )}
        </p>
        <Field id="hedge-action-date" label={t("accounting.settings.hedges.actionDate")} required>
          <DatePicker
            id="hedge-action-date"
            name="date"
            value={input.date}
            onChange={(date) => setInput((current) => ({ ...current, date }))}
          />
        </Field>
        {settle && (
          <Field
            id="hedge-action-rate"
            label={t("accounting.settings.hedges.settlementRate")}
            required
          >
            <Input
              id="hedge-action-rate"
              name="settlementRate"
              inputMode="decimal"
              value={input.rate}
              onChange={(event) =>
                setInput((current) => ({ ...current, rate: event.target.value }))
              }
            />
          </Field>
        )}
        <Field
          id="hedge-action-account"
          label={t(
            settle
              ? "accounting.settings.hedges.cashAccount"
              : "accounting.settings.hedges.targetAccount",
          )}
          required
        >
          <FormSelect
            id="hedge-action-account"
            name="accountId"
            value={input.accountId}
            onChange={(accountId) => setInput((current) => ({ ...current, accountId }))}
            placeholder={t("accounting.journal.form.selectAccount")}
            options={
              settle
                ? accountOptions(accounts, "Asset")
                : accountOptions(accounts, ["Asset", "Expense", "Revenue"])
            }
          />
        </Field>
      </form>
    </FormModal>
  );
}
