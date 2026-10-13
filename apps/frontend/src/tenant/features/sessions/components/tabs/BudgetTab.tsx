import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { BudgetOverviewCards } from "./budget/BudgetOverviewCards";
import { BudgetSection } from "./budget/BudgetSection";
import { BudgetAddModal } from "./budget/BudgetAddModal";
import { useBudgetTabState } from "./budget/useBudgetTabState";
import type { BudgetTabProps } from "./budget/budgetTabShared";

export type { BudgetTabProps };

export function BudgetTab({
  session,
  onUpdate,
  canWrite = true,
  canMutate,
}: BudgetTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const { activeCurrency } = useFinanceCurrency();
  const currencyLabel = activeCurrency?.symbol || session.currency || "";
  const isWritable = canMutate ?? canWrite;

  const {
    modalOpen,
    setModalOpen,
    targetClassId,
    setTargetClassId,
    budgetType,
    detail,
    setDetail,
    amount,
    setAmount,
    deleteTarget,
    setDeleteTarget,
    saving,
    classes,
    incomes,
    expenses,
    totalIncome,
    totalExpenses,
    balance,
    handleOpenAdd,
    handleSaveItem,
    handleDeleteItem,
  } = useBudgetTabState(session, onUpdate);

  return (
    <div className="space-y-5">
      <BudgetOverviewCards
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        balance={balance}
        currency={session.currency}
      />

      <BudgetSection
        type="income"
        headingId="income-heading"
        title={t("sessions.budget.incomeTitle")}
        items={incomes}
        emptyTitle={t("sessions.budget.emptyIncomeLogged")}
        currency={session.currency}
        isWritable={isWritable}
        canAdd={classes.length > 0}
        onAdd={() => handleOpenAdd("income")}
        onDelete={(item) =>
          setDeleteTarget({ classId: item.classId, budgetId: item.id, detail: item.detail })
        }
      />

      <BudgetSection
        type="expense"
        headingId="expense-heading"
        title={t("sessions.budget.expenseTitle")}
        items={expenses}
        emptyTitle={t("sessions.budget.emptyExpenseLogged")}
        currency={session.currency}
        isWritable={isWritable}
        canAdd={classes.length > 0}
        onAdd={() => handleOpenAdd("expense")}
        onDelete={(item) =>
          setDeleteTarget({ classId: item.classId, budgetId: item.id, detail: item.detail })
        }
      />

      <BudgetAddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        budgetType={budgetType}
        classes={classes}
        targetClassId={targetClassId}
        onTargetClassIdChange={setTargetClassId}
        detail={detail}
        onDetailChange={setDetail}
        amount={amount}
        onAmountChange={setAmount}
        currencyLabel={currencyLabel}
        saving={saving}
        onSave={handleSaveItem}
      />

      <ConfirmAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("sessions.budget.confirmDeleteTitle")}
        description={t("sessions.budget.confirmDeleteDescription", {
          name: deleteTarget?.detail ?? "",
        })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          void handleDeleteItem();
        }}
      />
    </div>
  );
}
