import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionClassRefreshment } from "@/lib/data/sessionsData";

interface ClassDetailRefreshmentItemProps {
  refreshment: SessionClassRefreshment;
  onUpdate: (id: string, patch: Partial<SessionClassRefreshment>) => void;
  onRemove: (id: string) => void;
  /** When true, omit trash (parent FormListFieldCard owns remove). */
  hideRemove?: boolean;
}

export function ClassDetailRefreshmentItem({
  refreshment: r,
  onUpdate,
  onRemove,
  hideRemove = false,
}: ClassDetailRefreshmentItemProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      <Input
        id={`refreshment-date-${r.id}`}
        name={`refreshment-date-${r.id}`}
        type="date"
        value={r.date.slice(0, 10)}
        onChange={(e) => onUpdate(r.id, { date: e.target.value })}
        aria-label={t("sessions.tabarruk.form.date")}
        className="w-32 text-xs"
      />
      <Input
        id={`refreshment-item-${r.id}`}
        name={`refreshment-item-${r.id}`}
        placeholder={t("sessions.classes.detail.refreshments.itemPlaceholder")}
        aria-label={t("sessions.classes.detail.refreshments.itemPlaceholder")}
        value={r.item}
        onChange={(e) => onUpdate(r.id, { item: e.target.value })}
        className="flex-1 text-xs"
      />
      <Input
        id={`refreshment-qty-${r.id}`}
        name={`refreshment-qty-${r.id}`}
        type="text"
        inputMode="numeric"
        placeholder={t("sessions.classes.detail.refreshments.qty")}
        aria-label={t("sessions.classes.detail.refreshments.qty")}
        value={r.quantity === 0 ? "" : String(r.quantity)}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "" || /^\d+$/.test(val)) {
            onUpdate(r.id, { quantity: parseInt(val, 10) || 0 });
          }
        }}
        className="w-16 text-xs"
      />
      <div className="relative w-24">
        <Input
          id={`refreshment-price-${r.id}`}
          name={`refreshment-price-${r.id}`}
          type="text"
          inputMode="decimal"
          placeholder={t("sessions.classes.detail.refreshments.price")}
          aria-label={t("sessions.classes.detail.refreshments.price")}
          value={r.pricePerUnit === 0 ? "" : String(r.pricePerUnit)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
              onUpdate(r.id, { pricePerUnit: parseFloat(val) || 0 });
            }
          }}
          className="text-xs"
        />
      </div>
      <div className="relative w-24">
        <Input
          id={`refreshment-paid-${r.id}`}
          name={`refreshment-paid-${r.id}`}
          type="text"
          inputMode="decimal"
          placeholder={t("sessions.classes.detail.refreshments.paid")}
          aria-label={t("sessions.classes.detail.refreshments.paid")}
          value={r.paidAmount === 0 ? "" : String(r.paidAmount)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
              onUpdate(r.id, { paidAmount: parseFloat(val) || 0 });
            }
          }}
          className="text-xs"
        />
      </div>
      {hideRemove ? null : (
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("sessions.classes.detail.removeItem")}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(r.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
