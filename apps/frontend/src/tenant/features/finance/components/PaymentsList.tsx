import { useState } from "react";
import { type Payment } from '@/lib/data/financeData';
import { PAYMENT_METHOD_BADGE, SEMANTIC_BADGE } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { type ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { type AppTranslationKey } from "@mms/shared";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { ModuleTrashConfirmDialogs } from "@/components/ui/ModuleTrashConfirmDialogs";
import { PaymentsListContent, PAYMENT_TRACKER_COLUMN_KEYS } from "@/tenant/features/finance/components/PaymentsListContent";
import { PaymentMethodSummary, PaymentSelectionBar } from "@/tenant/features/finance/components/PaymentsListFilters";
import type { StatusBadgeConfigItem } from '@/components/ui/StatusBadge';

const METHOD_LABEL_KEYS: Record<string, AppTranslationKey> = {
  Cash: "finance.paymentMethod.cash",
  "Bank Transfer": "finance.paymentMethod.bank_transfer",
  Cheque: "finance.paymentMethod.cheque",
  Online: "finance.paymentMethod.online",
  Card: "finance.paymentMethod.card",
  Other: "finance.paymentMethod.other",
};

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;
export interface PaymentsListProps {
  onRowClick?: (id: string) => void;
  payments: Payment[];
  canDelete?: boolean;
  showDeleted?: boolean;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkRestore?: (ids: string[]) => void;
  selectedIds?: string[];
  onTogglePayment?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
}

export function PaymentsList({
  payments,
  canDelete = false,
  showDeleted = false,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  selectedIds = [],
  onTogglePayment,
  onToggleSelectAll,
  onClearSelection,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  columnCustomizer,
  onRowClick,
}: PaymentsListProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  const paymentsByMethod = payments.reduce<Record<string, { amount: number; count: number }>>((amountByMethod, payment) => {
    const current = amountByMethod[payment.method] ?? { amount: 0, count: 0 };
    amountByMethod[payment.method] = {
      amount: current.amount + payment.amount,
      count: current.count + 1,
    };
    return amountByMethod;
  }, {});

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;
  const visibleColCount =
    PAYMENT_TRACKER_COLUMN_KEYS.filter(columnVisible).length +
    (canDelete ? 2 : 0);
  const selectedSet = new Set(selectedIds);
  const allSelected = payments.length > 0 && payments.every((payment) => selectedSet.has(payment.id));

  const methodConfig = (() => {
    const entries = Object.keys(PAYMENT_METHOD_BADGE).map((method) => [
      method,
      {
        label: t(METHOD_LABEL_KEYS[method] ?? "finance.paymentMethod.other"),
        cls: PAYMENT_METHOD_BADGE[method] || SEMANTIC_BADGE.muted,
      },
    ] as const);
    return Object.fromEntries(entries);
  })() as Record<string, StatusBadgeConfigItem>;

  return (
    <section aria-label={t("finance.payments")} className="space-y-4">
      <PaymentMethodSummary paymentsByMethod={paymentsByMethod} methodConfig={methodConfig} formatCurrency={formatCurrency} />
      {canDelete && (
        <PaymentSelectionBar
          selectedCount={selectedIds.length}
          showDeleted={showDeleted}
          onOpenBulkConfirm={() => setConfirmBulkOpen(true)}
          onClearSelection={onClearSelection ?? (() => {})}
        />
      )}
      <PaymentsListContent
        payments={payments}
        selectedIds={selectedIds}
        isColumnVisible={columnVisible}
        visibleColCount={visibleColCount}
        allSelected={allSelected}
        canDelete={canDelete}
        showDeleted={showDeleted}
        totalPaid={totalPaid}
        methodConfig={methodConfig}
        columnCustomizer={columnCustomizer}
        formatCurrency={formatCurrency}
        getColumnWidth={getColumnWidth}
        onColumnResize={onColumnResize}
        onTogglePayment={(paymentId, checked) => onTogglePayment?.(paymentId, checked)}
        onToggleAll={(checked) => onToggleSelectAll?.(checked, payments.map((payment) => payment.id))}
        onRequestDelete={setPendingDeleteId}
        onRestore={onRestore}
      />
      <ModuleTrashConfirmDialogs
        pendingTrashId={pendingDeleteId}
        onPendingTrashIdChange={setPendingDeleteId}
        confirmBulkOpen={confirmBulkOpen}
        onConfirmBulkOpenChange={setConfirmBulkOpen}
        showDeleted={showDeleted}
        selectedCount={selectedIds.length}
        i18nNamespace="finance"
        onConfirmRowTrash={() => {
          if (pendingDeleteId) onDelete?.(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onConfirmBulkTrash={() => {
          if (showDeleted) onBulkRestore?.(selectedIds);
          else onBulkDelete?.(selectedIds);
          onClearSelection?.();
          setConfirmBulkOpen(false);
        }}
        labels={{
          singleDescription: t("finance.trash.deletePaymentConfirm"),
        }}
      />
    </section>
  );
}
