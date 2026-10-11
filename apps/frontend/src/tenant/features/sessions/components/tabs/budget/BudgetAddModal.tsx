import React from "react";
import { Wallet } from "lucide-react";
import { FormModal } from "@/components/ui/FormModal";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { Class } from "@/lib/data/sessionsData";

interface BudgetAddModalProps {
  open: boolean;
  onClose: () => void;
  budgetType: "income" | "expense";
  classes: Class[];
  targetClassId: string;
  onTargetClassIdChange: (id: string) => void;
  detail: string;
  onDetailChange: (detail: string) => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  currencyLabel: string;
  saving: boolean;
  onSave: () => Promise<void> | void;
}

export function BudgetAddModal({
  open,
  onClose,
  budgetType,
  classes,
  targetClassId,
  onTargetClassIdChange,
  detail,
  onDetailChange,
  amount,
  onAmountChange,
  currencyLabel,
  saving,
  onSave,
}: BudgetAddModalProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={
        budgetType === "income"
          ? t("sessions.budget.addIncomeTitle")
          : t("sessions.budget.addExpenseTitle")
      }
      icon={Wallet}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={onSave}
      saving={saving}
      saveDisabled={saving || !targetClassId || !amount || amount <= 0}
      formId="budget-add-form"
    >
      <form
        id="budget-add-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && targetClassId && amount && amount > 0) void onSave();
        }}
        className="space-y-4"
      >
        <Field id="target-class" label={t("sessions.classes.fallbackName")} required>
          <FormSelect
            id="target-class"
            name="targetClassId"
            value={targetClassId}
            onChange={onTargetClassIdChange}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            className="w-full"
          />
        </Field>

        <Field id="budget-detail" label={t("sessions.budget.form.note")}>
          <Input
            id="budget-detail"
            name="detail"
            value={detail}
            onChange={(e) => onDetailChange(e.target.value)}
            placeholder={t("sessions.budget.detailPlaceholder")}
          />
        </Field>

        <Field
          id="budget-amount"
          label={
            currencyLabel
              ? t("sessions.budget.form.amount", { currency: currencyLabel })
              : t("sessions.budget.form.amountPlain")
          }
          required
        >
          <Input
            id="budget-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount ? String(amount) : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                onAmountChange(parseFloat(val) || 0);
              }
            }}
          />
        </Field>
      </form>
    </FormModal>
  );
}
