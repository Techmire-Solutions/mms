import React from "react";
import { AlarmClock, Bell, CalendarRange, Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface FinancePageHeaderActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  collectPending: boolean;
  remindPending: boolean;
  onCollectOverdue: () => void;
  onRemindInvoices: () => void;
  onGenerateInvoices: () => void;
  onCreateInvoice: () => void;
  onImport: () => void;
  onExport?: () => void;
}

export function FinancePageHeaderActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  collectPending,
  remindPending,
  onCollectOverdue,
  onRemindInvoices,
  onGenerateInvoices,
  onCreateInvoice,
  onImport,
  onExport,
}: FinancePageHeaderActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!canWrite || showDeleted) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canExport && onExport ? (
        <Button
          variant="ghost"
          icon={Download}
          onClick={onExport}
          loading={isExporting}
          disabled={isExporting}
        >
          {t("common.export")}
        </Button>
      ) : null}
      <Button variant="outline" icon={Upload} onClick={onImport}>
        {t("common.import")}
      </Button>
      <Button
        variant="outline"
        icon={AlarmClock}
        loading={collectPending}
        onClick={onCollectOverdue}
      >
        {t("finance.collect.action")}
      </Button>
      <Button
        variant="outline"
        icon={Bell}
        loading={remindPending}
        onClick={onRemindInvoices}
      >
        {t("finance.collect.remindAction")}
      </Button>
      <Button
        variant="outline"
        icon={CalendarRange}
        onClick={onGenerateInvoices}
      >
        {t("finance.generate.action")}
      </Button>
      <Button variant="primary" icon={Plus} onClick={onCreateInvoice}>
        {t("finance.newInvoice")}
      </Button>
    </div>
  );
}
