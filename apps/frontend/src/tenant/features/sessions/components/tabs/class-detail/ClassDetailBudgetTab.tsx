import React from "react";
import { Coffee } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FormCardTypeSelect,
  FormCollectionShell,
  FormListFieldCard,
  FormSelect,
  TYPE_SELECT_WIDTH,
} from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionClassBudget, SessionClassRefreshment } from "@/lib/data/sessionsData";
import { ClassDetailRefreshmentItem } from "./ClassDetailRefreshmentItem";

interface ClassDetailBudgetTabProps {
  budgets: SessionClassBudget[];
  refreshments: SessionClassRefreshment[];
  currencySymbol: string;
  onAddBudget: () => void;
  onRemoveBudget: (id: string) => void;
  onUpdateBudget: (id: string, patch: Partial<SessionClassBudget>) => void;
  onAddRefreshment: () => void;
  onRemoveRefreshment: (id: string) => void;
  onUpdateRefreshment: (id: string, patch: Partial<SessionClassRefreshment>) => void;
}

export function ClassDetailBudgetTab({
  budgets,
  refreshments,
  onAddBudget,
  onRemoveBudget,
  onUpdateBudget,
  onAddRefreshment,
  onRemoveRefreshment,
  onUpdateRefreshment,
}: ClassDetailBudgetTabProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <FormCollectionShell
        isEmpty={budgets.length === 0}
        emptyMessage={t("sessions.classes.detail.budget.empty")}
        addLabel={t("sessions.classes.detail.budget.add")}
        onAdd={onAddBudget}
        listKey="class-budgets"
      >
        {budgets.map((b, index) => (
          <FormListFieldCard
            key={b.id}
            id={b.id}
            index={index}
            typeSelect={
              <FormCardTypeSelect label={t("sessions.classes.detail.budget.title")}>
                <FormSelect
                  id={`budget-type-${b.id}`}
                  name="budgetType"
                  aria-label={t("sessions.classes.detail.budget.title")}
                  value={b.budgetType}
                  onChange={(val) =>
                    onUpdateBudget(b.id, { budgetType: val as "income" | "expense" })
                  }
                  options={[
                    { value: "income", label: t("sessions.classes.detail.budget.income") },
                    { value: "expense", label: t("sessions.classes.detail.budget.expense") },
                  ]}
                  className={TYPE_SELECT_WIDTH}
                />
              </FormCardTypeSelect>
            }
            removeLabel={t("sessions.classes.detail.removeItem")}
            onRemove={() => onRemoveBudget(b.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`budget-detail-${b.id}`}
                name={`budget-detail-${b.id}`}
                placeholder={t("sessions.classes.detail.budget.detailPlaceholder")}
                aria-label={t("sessions.classes.detail.budget.detailPlaceholder")}
                value={b.detail}
                onChange={(e) => onUpdateBudget(b.id, { detail: e.target.value })}
                className="min-w-0 flex-1 text-xs"
              />
              <Input
                id={`budget-amount-${b.id}`}
                name={`budget-amount-${b.id}`}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                aria-label={t("sessions.classes.detail.amount")}
                value={b.amount === 0 ? "" : String(b.amount)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                    onUpdateBudget(b.id, { amount: parseFloat(val) || 0 });
                  }
                }}
                className="w-32 text-xs"
              />
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>

      <FormCollectionShell
        title={t("sessions.classes.detail.refreshments.title")}
        icon={Coffee}
        isEmpty={refreshments.length === 0}
        emptyMessage={t("sessions.classes.detail.refreshments.empty")}
        addLabel={t("sessions.classes.detail.refreshments.add")}
        onAdd={onAddRefreshment}
        listKey="class-refreshments"
      >
        {refreshments.map((r, index) => (
          <FormListFieldCard
            key={r.id}
            id={r.id}
            index={index}
            removeLabel={t("sessions.classes.detail.removeItem")}
            onRemove={() => onRemoveRefreshment(r.id)}
          >
            <ClassDetailRefreshmentItem
              refreshment={r}
              onUpdate={onUpdateRefreshment}
              onRemove={onRemoveRefreshment}
              hideRemove
            />
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
