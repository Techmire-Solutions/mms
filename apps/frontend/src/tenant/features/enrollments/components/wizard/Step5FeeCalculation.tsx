import React from "react";
import { DollarSign, Tag, Info } from "lucide-react";
import { calcFee, type CalculatedFee } from "@/lib/data/enrollmentData";
import { type Student } from "@/lib/data/studentsData";
import { type Session } from "@/lib/data/sessionsData";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { Badge } from "@/components/ui/badge";

export interface Step5FeeCalculationProps {
  student: Student | null | undefined;
  session: Session | null | undefined;
  feeResult: CalculatedFee | null | undefined;
  onFeeResult: (fee: CalculatedFee) => void;
}

export function Step5FeeCalculation({
  student,
  session,
  feeResult,
  onFeeResult,
}: Step5FeeCalculationProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const baseFee = session?.baseFee || 0;
  const sessionDiscounts =
    (
      session as {
        discounts?: Array<{ id?: string; name?: string; percentage?: number; type?: string }>;
      } | null
    )?.discounts ?? [];
  const discountsKey = JSON.stringify(sessionDiscounts);
  const fee = React.useMemo(() => {
    return calcFee(baseFee, student || {}, [], sessionDiscounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on stable granular fields + discountsKey; adding the `student`/`sessionDiscounts` object deps would recreate `fee` every render and re-fire the onFeeResult effect.
  }, [baseFee, student?.id, student?.discountType, student?.discountPct, discountsKey]);

  // Notify parent
  React.useEffect(() => {
    onFeeResult(fee);
  }, [fee, onFeeResult]);

  const displayFee = feeResult || fee;

  return (
    <section className="space-y-5" aria-labelledby="step5-title">
      <div>
        <h3 id="step5-title" className="text-base font-bold text-foreground">
          {t("enrollments.wizard.step5Title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("enrollments.wizard.step5Desc")}</p>
      </div>

      {/* Fee Breakdown */}
      <div className={`${WORK_SURFACE} overflow-hidden`}>
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" aria-hidden="true" />
          <h4 className="text-sm font-bold text-foreground">
            {t("enrollments.wizard.step5BreakdownTitle")}
          </h4>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("enrollments.wizard.step5BaseFee", {
                session: session?.name || t("enrollments.detail.session"),
              })}
            </span>
            <span className="text-sm font-semibold text-foreground">{formatCurrency(baseFee)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">{displayFee.label}</span>
              {displayFee.pct > 0 && (
                <Badge
                  pill
                  tone="primary"
                  className="px-1.5 font-bold"
                  aria-label={t("enrollments.wizard.step5DiscountPercentAria", {
                    pct: displayFee.pct,
                  })}
                >
                  –{displayFee.pct}%
                </Badge>
              )}
            </div>
            <span
              className={`text-sm font-semibold ${displayFee.discountAmt > 0 ? "text-success" : "text-muted-foreground"}`}
            >
              {displayFee.discountAmt > 0
                ? `– ${formatCurrency(displayFee.discountAmt)}`
                : formatCurrency(0)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
            <span className="text-sm font-bold text-foreground">
              {t("enrollments.wizard.step5FinalAmountDue")}
            </span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(displayFee.finalFee)}
            </span>
          </div>
        </div>
      </div>

      {/* Discount reason */}
      {displayFee.pct > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-success/10 border border-success/30"
          role="status"
        >
          <Info className="w-4 h-4 text-success flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold text-success">
              {t("enrollments.wizard.step5DiscountApplied", {
                label: displayFee.label,
                pct: displayFee.pct,
              })}
            </p>
            {displayFee.reason && (
              <p className="text-xs text-success mt-0.5">{displayFee.reason}</p>
            )}
          </div>
        </div>
      )}

      {displayFee.pct === 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-muted border border-border"
          role="status"
        >
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">{t("enrollments.wizard.step5NoDiscount")}</p>
        </div>
      )}

      {/* Available discounts */}
      {(() => {
        const availableDiscounts = (session?.classes || []).flatMap((c) =>
          (c.discounts || [])
            .filter((d) => d.status === "active")
            .map((d) => ({
              id: d.id,
              name: d.discountType,
              value: d.percentage,
              className: c.name,
            })),
        );
        if (availableDiscounts.length === 0) return null;
        return (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("enrollments.wizard.step5AvailableDiscounts")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list">
              {availableDiscounts.map((discount) => (
                <div
                  key={discount.id}
                  className={`p-3 rounded-xl border ${discount.name === displayFee.label ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  role="listitem"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-bold text-foreground">
                      {discount.name} ({discount.className})
                    </p>
                    <span className="shrink-0 text-xs font-bold text-primary">
                      {t("enrollments.wizard.step5PercentOff", { pct: discount.value })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
