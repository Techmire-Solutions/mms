import { useState } from "react";
import { generateClientEntityId, toMoneyNumber } from "@mms/shared";
import type { Session, SessionClassBudget } from "@/lib/data/sessionsData";
import type { BudgetItemWithClass, DeleteBudgetTarget } from "./budgetTabShared";

export function useBudgetTabState(
  session: Session,
  onUpdate: (session: Session) => void | Promise<void>,
) {
  const [modalOpen, setModalOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [budgetType, setBudgetType] = useState<"income" | "expense">("income");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteBudgetTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const classes = session.classes || [];

  const allBudgetItems: BudgetItemWithClass[] = classes.flatMap((c) =>
    (c.budgets || []).map((b) => ({ ...b, className: c.name, classId: c.id })),
  );

  const incomes = allBudgetItems.filter((b) => b.budgetType === "income");
  const expenses = allBudgetItems.filter((b) => b.budgetType === "expense");

  const totalIncome = incomes.reduce((sum, b) => sum + (toMoneyNumber(b.amount) ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, b) => sum + (toMoneyNumber(b.amount) ?? 0), 0);
  const balance = totalIncome - totalExpenses;

  const handleOpenAdd = (type: "income" | "expense") => {
    setBudgetType(type);
    setTargetClassId(classes[0]?.id || "");
    setDetail("");
    setAmount("");
    setModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!targetClassId || !detail.trim()) return;
    setSaving(true);
    try {
      const updatedClasses = classes.map((c) => {
        if (c.id === targetClassId) {
          const newBudget: SessionClassBudget = {
            id: generateClientEntityId("bgt", "-"),
            classId: c.id,
            budgetType,
            detail: detail.trim(),
            amount: amount.trim() || "0",
          };
          return {
            ...c,
            budgets: [...(c.budgets || []), newBudget],
          };
        }
        return c;
      });

      await onUpdate({ ...session, classes: updatedClasses });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const updatedClasses = classes.map((c) => {
        if (c.id === deleteTarget.classId) {
          return {
            ...c,
            budgets: (c.budgets || []).filter((b) => b.id !== deleteTarget.budgetId),
          };
        }
        return c;
      });
      await onUpdate({ ...session, classes: updatedClasses });
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  return {
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
  };
}
