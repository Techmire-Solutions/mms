import React from "react";
import { Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FormCardTypeSelect,
  FormCollectionShell,
  FormListFieldCard,
  FormSelect,
  TYPE_SELECT_WIDTH,
} from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { SessionClassFee, SessionClassDiscount } from "@/lib/data/sessionsData";

interface ClassDetailFeesTabProps {
  fees: SessionClassFee[];
  discounts: SessionClassDiscount[];
  currencySymbol: string;
  onAddFee: () => void;
  onRemoveFee: (id: string) => void;
  onUpdateFee: (id: string, patch: Partial<SessionClassFee>) => void;
  onAddDiscount: () => void;
  onRemoveDiscount: (id: string) => void;
  onUpdateDiscount: (id: string, patch: Partial<SessionClassDiscount>) => void;
}

export function ClassDetailFeesTab({
  fees,
  discounts,
  currencySymbol,
  onAddFee,
  onRemoveFee,
  onUpdateFee,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
}: ClassDetailFeesTabProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <FormCollectionShell
        isEmpty={fees.length === 0}
        emptyMessage={t("sessions.classes.detail.fees.empty")}
        addLabel={t("sessions.classes.detail.fees.add")}
        onAdd={onAddFee}
        listKey="class-fees"
      >
        {fees.map((fee, index) => (
          <FormListFieldCard
            key={fee.id}
            id={fee.id}
            index={index}
            removeLabel={t("sessions.classes.detail.removeItem")}
            onRemove={() => onRemoveFee(fee.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`fee-type-${fee.id}`}
                name={`fee-type-${fee.id}`}
                placeholder={t("sessions.classes.detail.fees.typePlaceholder")}
                aria-label={t("sessions.classes.detail.fees.typePlaceholder")}
                value={fee.feeType}
                onChange={(e) => onUpdateFee(fee.id, { feeType: e.target.value })}
                className="min-w-0 flex-1 text-xs"
              />
              <div className="relative w-36">
                {currencySymbol ? (
                  <span className="absolute start-2.5 top-2 text-xs text-muted-foreground">
                    {currencySymbol}
                  </span>
                ) : null}
                <Input
                  id={`fee-amount-${fee.id}`}
                  name={`fee-amount-${fee.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder={t("sessions.classes.detail.amount")}
                  aria-label={t("sessions.classes.detail.amount")}
                  value={fee.amount === 0 ? "" : String(fee.amount)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                      onUpdateFee(fee.id, { amount: parseFloat(val) || 0 });
                    }
                  }}
                  className={cn("text-xs", currencySymbol && "ps-6")}
                />
              </div>
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>

      <FormCollectionShell
        title={t("sessions.classes.detail.discounts.title")}
        icon={Tag}
        isEmpty={discounts.length === 0}
        emptyMessage={t("sessions.classes.detail.discounts.empty")}
        addLabel={t("sessions.discounts.add")}
        onAdd={onAddDiscount}
        listKey="class-discounts"
      >
        {discounts.map((discount, index) => (
          <FormListFieldCard
            key={discount.id}
            id={discount.id}
            index={index}
            typeSelect={
              <FormCardTypeSelect label={t("common.status")}>
                <FormSelect
                  id={`disc-status-${discount.id}`}
                  name="status"
                  aria-label={t("common.status")}
                  value={discount.status || "active"}
                  onChange={(val) =>
                    onUpdateDiscount(discount.id, {
                      status: val as "active" | "expired" | "inactive",
                    })
                  }
                  options={[
                    { value: "active", label: t("sessions.discounts.active") },
                    { value: "expired", label: t("sessions.classes.detail.discounts.expired") },
                    { value: "inactive", label: t("sessions.discounts.inactive") },
                  ]}
                  className={TYPE_SELECT_WIDTH}
                />
              </FormCardTypeSelect>
            }
            removeLabel={t("sessions.classes.detail.removeItem")}
            onRemove={() => onRemoveDiscount(discount.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`discount-name-${discount.id}`}
                name={`discount-name-${discount.id}`}
                placeholder={t("sessions.classes.detail.discounts.namePlaceholder")}
                aria-label={t("sessions.classes.detail.discounts.namePlaceholder")}
                value={discount.discountType}
                onChange={(e) => onUpdateDiscount(discount.id, { discountType: e.target.value })}
                className="min-w-0 flex-1 text-xs"
              />
              <div className="relative w-24">
                <Input
                  id={`discount-pct-${discount.id}`}
                  name={`discount-pct-${discount.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={t("sessions.discounts.type.percentage")}
                  value={discount.percentage === 0 ? "" : String(discount.percentage)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                      const num = parseFloat(val) || 0;
                      if (num <= 100) {
                        onUpdateDiscount(discount.id, { percentage: num });
                      }
                    }
                  }}
                  className="text-xs pe-6"
                />
                <span className="absolute end-2.5 top-2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
