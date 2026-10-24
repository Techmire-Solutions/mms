import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Class,
  SessionClassFee,
  SessionClassDiscount,
  SessionClassBudget,
  SessionClassRefreshment,
} from "@/lib/data/sessionsData";

export function useClassDetailFinancialDraft(setClassDraft: Dispatch<SetStateAction<Class>>) {
  const addFeeRow = useCallback(() => {
    setClassDraft((prev) => {
      const newFee: SessionClassFee = {
        id: crypto.randomUUID(),
        classId: prev.id,
        feeType: "Tuition Fee",
        amount: 0,
      };
      return { ...prev, fees: [...(prev.fees || []), newFee] };
    });
  }, [setClassDraft]);

  const removeFeeRow = useCallback(
    (id: string) => {
      setClassDraft((prev) => ({ ...prev, fees: (prev.fees || []).filter((f) => f.id !== id) }));
    },
    [setClassDraft],
  );

  const updateFeeRow = useCallback(
    (id: string, patch: Partial<SessionClassFee>) => {
      setClassDraft((prev) => ({
        ...prev,
        fees: (prev.fees || []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }));
    },
    [setClassDraft],
  );

  const addDiscountRow = useCallback(() => {
    setClassDraft((prev) => {
      const newDiscount: SessionClassDiscount = {
        id: crypto.randomUUID(),
        classId: prev.id,
        discountType: "Sibling Discount",
        percentage: 0,
        status: "active",
        startDate: "",
        endDate: "",
        eligibilityCriteria: {},
      };
      return { ...prev, discounts: [...(prev.discounts || []), newDiscount] };
    });
  }, [setClassDraft]);

  const removeDiscountRow = useCallback(
    (id: string) => {
      setClassDraft((prev) => ({
        ...prev,
        discounts: (prev.discounts || []).filter((d) => d.id !== id),
      }));
    },
    [setClassDraft],
  );

  const updateDiscountRow = useCallback(
    (id: string, patch: Partial<SessionClassDiscount>) => {
      setClassDraft((prev) => ({
        ...prev,
        discounts: (prev.discounts || []).map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));
    },
    [setClassDraft],
  );

  const addBudgetRow = useCallback(() => {
    setClassDraft((prev) => {
      const newBudget: SessionClassBudget = {
        id: crypto.randomUUID(),
        classId: prev.id,
        budgetType: "expense",
        detail: "Class Materials & Stationary",
        amount: 0,
      };
      return { ...prev, budgets: [...(prev.budgets || []), newBudget] };
    });
  }, [setClassDraft]);

  const removeBudgetRow = useCallback(
    (id: string) => {
      setClassDraft((prev) => ({
        ...prev,
        budgets: (prev.budgets || []).filter((b) => b.id !== id),
      }));
    },
    [setClassDraft],
  );

  const updateBudgetRow = useCallback(
    (id: string, patch: Partial<SessionClassBudget>) => {
      setClassDraft((prev) => ({
        ...prev,
        budgets: (prev.budgets || []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
    },
    [setClassDraft],
  );

  const addRefreshmentRow = useCallback(() => {
    setClassDraft((prev) => {
      const newRefreshment: SessionClassRefreshment = {
        id: crypto.randomUUID(),
        classId: prev.id,
        date: new Date().toISOString().slice(0, 10),
        item: "Snacks & Juices",
        quantity: 0,
        pricePerUnit: 0,
        paidAmount: 0,
      };
      return { ...prev, refreshments: [...(prev.refreshments || []), newRefreshment] };
    });
  }, [setClassDraft]);

  const removeRefreshmentRow = useCallback(
    (id: string) => {
      setClassDraft((prev) => ({
        ...prev,
        refreshments: (prev.refreshments || []).filter((r) => r.id !== id),
      }));
    },
    [setClassDraft],
  );

  const updateRefreshmentRow = useCallback(
    (id: string, patch: Partial<SessionClassRefreshment>) => {
      setClassDraft((prev) => ({
        ...prev,
        refreshments: (prev.refreshments || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    [setClassDraft],
  );

  return {
    addFeeRow,
    removeFeeRow,
    updateFeeRow,
    addDiscountRow,
    removeDiscountRow,
    updateDiscountRow,
    addBudgetRow,
    removeBudgetRow,
    updateBudgetRow,
    addRefreshmentRow,
    removeRefreshmentRow,
    updateRefreshmentRow,
  };
}
