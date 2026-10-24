import React from "react";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney } from "@mms/shared";
import { SectionHeader } from "@shared/ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import type { BudgetItemWithClass } from "./budgetTabShared";

interface BudgetSectionProps {
  type: "income" | "expense";
  headingId: string;
  title: string;
  items: BudgetItemWithClass[];
  emptyTitle: string;
  currency?: string;
  isWritable: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onDelete: (item: BudgetItemWithClass) => void;
}

export function BudgetSection({
  type,
  headingId,
  title,
  items,
  emptyTitle,
  currency,
  isWritable,
  canAdd,
  onAdd,
  onDelete,
}: BudgetSectionProps): React.JSX.Element {
  const isIncome = type === "income";
  const Icon = isIncome ? TrendingUp : TrendingDown;
  const toneClass = isIncome ? "text-success" : "text-destructive";
  const bgToneClass = isIncome ? "bg-success/10" : "bg-destructive/10";
  const btnClasses = isIncome
    ? "border-success/20 bg-success/10 text-success hover:bg-success/15 hover:text-success"
    : "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive";
  const addLabel = isIncome ? "Add Income" : "Add Expense";

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader
        headingLevel={3}
        headingId={headingId}
        icon={<Icon className={`w-4 h-4 ${toneClass}`} aria-hidden="true" />}
        iconClassName={bgToneClass}
        title={title}
        actions={
          isWritable &&
          canAdd && (
            <Button
              onClick={onAdd}
              className={`flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors sm:w-auto ${btnClasses}`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {addLabel}
            </Button>
          )
        }
      />
      <div className="rounded-xl border border-border overflow-hidden">
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} compact icon={null} />
        ) : (
          items.map((item, index) => (
            <article
              key={item.id}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${index > 0 ? "border-t border-border/50" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-foreground">{item.detail}</p>
                <p className="m-0 truncate text-xs text-muted-foreground">
                  Class: {item.className}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:contents">
                <p className={`m-0 shrink-0 text-sm font-bold ${toneClass}`}>
                  {formatMoney(item.amount, currency)}
                </p>
                {isWritable && (
                  <Button
                    aria-label={`Delete ${item.detail}`}
                    onClick={() => onDelete(item)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    variant="ghost"
                    size="icon"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
