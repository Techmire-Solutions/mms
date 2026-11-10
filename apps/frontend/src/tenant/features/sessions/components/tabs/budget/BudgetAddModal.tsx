import React, { useState } from "react";
import { useDirtySnapshot } from "@/lib/forms/useDirtySnapshot";
import { Wallet } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/FormPrimitives";
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
  const [serverError, setServerError] = useState<string | null>(null);
  const { isDirty } = useDirtySnapshot(
    { targetClassId, detail, amount, budgetType },
    `${open}|${budgetType}`,
  );
  const detailInvalid = !detail.trim();
  const amountInvalid = !amount || amount <= 0;

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
      onSave={async () => {
        setServerError(null);
        try {
          await onSave();
        } catch (error) {
          setServerError(error instanceof Error ? error.message : "Could not save budget");
        }
      }}
      saving={saving}
      saveDisabled={saving || !targetClassId || detailInvalid || amountInvalid}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      error={serverError ?? undefined}
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

        <Field
          id="budget-detail"
          label={t("sessions.budget.form.note")}
          required
          error={detailInvalid ? t("common.formPleaseFixErrors") : undefined}
        >
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
          error={amountInvalid ? t("common.formPleaseFixErrors") : undefined}
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
