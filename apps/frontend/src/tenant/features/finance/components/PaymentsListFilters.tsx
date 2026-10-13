import { CreditCard } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CardTitleBar } from "@/components/app/CardTitleBar";
import {
  ModuleColumnCustomizer,
  type ModuleColumnCustomizerProps,
} from "@/components/app/ModuleColumnCustomizer";
import { ModuleUniversalBulkActionBar } from "@/components/app/ModuleUniversalBulkActionBar";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";

export interface PaymentMethodSummaryProps {
  paymentsByMethod: Record<string, { amount: number; count: number }>;
  methodConfig: Record<string, StatusBadgeConfigItem>;
  formatCurrency: (amount: number) => string;
}

export function PaymentMethodSummary({
  paymentsByMethod,
  methodConfig,
  formatCurrency,
}: PaymentMethodSummaryProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-label={t("finance.paymentsByMethod")}
    >
      {Object.entries(paymentsByMethod).map(([method, summary]) => (
        <Card key={method} className="p-3">
          <StatusBadge status={method} config={methodConfig} size="sm" />
          <p className="m-0 mt-2 text-base font-bold text-foreground">
            {formatCurrency(summary.amount)}
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {t("finance.paymentCount", { count: summary.count })}
          </p>
        </Card>
      ))}
    </div>
  );
}

export interface PaymentSelectionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  onOpenBulkConfirm: () => void;
  onClearSelection: () => void;
}

export function PaymentSelectionBar({
  selectedCount,
  showDeleted,
  onOpenBulkConfirm,
  onClearSelection,
}: PaymentSelectionBarProps): React.JSX.Element {
  return (
    <ModuleUniversalBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={true}
      onRequestBulkDelete={onOpenBulkConfirm}
      onRequestBulkRestore={onOpenBulkConfirm}
      onClearSelection={onClearSelection}
      bulkActions={["delete", "restore"]}
      leadingIcon={CreditCard}
      i18nNamespace="finance"
    />
  );
}

export interface PaymentLogHeaderProps {
  totalPaid: number;
  formatCurrency: (amount: number) => string;
  columnCustomizer?: ModuleColumnCustomizerProps;
}

export function PaymentLogHeader({
  totalPaid,
  formatCurrency,
  columnCustomizer,
}: PaymentLogHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <CardTitleBar
      icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
      title={t("finance.paymentLog")}
      actions={
        <>
          <span className="text-xs font-semibold text-success">
            {t("finance.paymentTotal", { amount: formatCurrency(totalPaid) })}
          </span>
          {columnCustomizer && (
            <ModuleColumnCustomizer
              columnRegistry={columnCustomizer.columnRegistry}
              updateUserColumnLayout={columnCustomizer.updateUserColumnLayout}
              labels={columnCustomizer.labels}
            />
          )}
        </>
      }
    />
  );
}
