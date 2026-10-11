import React from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface InvoiceFormSummarySectionProps {
  t: TranslationFunction;
  baseFee: number;
  discountAmt: number;
  finalAmt: number;
  formatCurrency: (amount: number) => string;
}

export function InvoiceFormSummarySection({
  t,
  baseFee,
  discountAmt,
  finalAmt,
  formatCurrency,
}: InvoiceFormSummarySectionProps): React.JSX.Element {
  return (
    <SectionCard accentColor="primary" padding="p-5">
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="m-0 text-xs font-bold uppercase text-muted-foreground">
            {t("finance.columns.baseFee")}
          </p>
          <p className="m-0 mt-0.5 font-bold text-foreground text-sm">{formatCurrency(baseFee)}</p>
        </div>
        <div>
          <p className="m-0 text-xs font-bold uppercase text-muted-foreground">
            {t("finance.columns.discount")}
          </p>
          <p className="m-0 mt-0.5 font-bold text-warning text-sm">
            -{formatCurrency(discountAmt)}
          </p>
        </div>
        <div>
          <p className="m-0 text-xs font-bold uppercase text-muted-foreground">
            {t("finance.form.finalAmount")}
          </p>
          <p className="m-0 mt-0.5 font-extrabold text-primary text-sm">
            {formatCurrency(finalAmt)}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
