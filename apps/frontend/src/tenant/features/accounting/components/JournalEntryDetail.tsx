import { Pencil, CheckCircle2, Printer, RotateCcw, Tag } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { formatDate, isJournalEntryBalanced, moneyToCents } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/Drawer";
import { ACCOUNT_TYPE_META, type Account, type JournalEntry } from "@/lib/data/accountingData";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE, balanceToneClass } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { DetailDrawerArchivedBanner } from "@/components/ui/DetailDrawerArchiveChrome";
import { JournalEntryDetailLines } from "@/tenant/features/accounting/components/JournalEntryDetailLines";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { DetailAttributeRow } from "@/components/ui/DetailAttributeRow";

interface JournalEntryDetailProps {
  entry: JournalEntry;
  accounts: Account[];
  /** Reference of the journal that reverses this one, when loaded. */
  reversedByRef?: string;
  onClose: () => void;
  onEdit?: () => void;
  onReverse?: () => void;
  onRestore?: () => void | Promise<void>;
  canRestore?: boolean;
  /** Present only for entries that can print a payment voucher (posted money-out). */
  onPrintVoucher?: () => void;
}

/**
 * Journal entry detail slide-over.
 */
export function JournalEntryDetail({
  entry,
  accounts,
  reversedByRef,
  onClose,
  onEdit,
  onReverse,
  onRestore,
  canRestore = true,
  onPrintVoucher,
}: JournalEntryDetailProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const isArchived = Boolean(entry.deletedAt);
  const journalStatusConfig: Record<string, StatusBadgeConfigItem> = {
    posted: { label: t("accounting.journal.status.posted"), cls: SEMANTIC_BADGE.successStrong },
    draft: { label: t("accounting.journal.status.draft"), cls: SEMANTIC_BADGE.warningStrong },
  };
  const accountTypeConfig = (() => {
    const config: Record<string, StatusBadgeConfigItem> = {};
    for (const [type, meta] of Object.entries(ACCOUNT_TYPE_META)) {
      config[type] = {
        label: t(`accounting.type.${type}` as AppTranslationKey),
        cls: meta.color,
      };
    }
    return config;
  })() as Record<string, StatusBadgeConfigItem>;
  const getAccount = (id: string) => accounts.find((account) => account.id === id);
  const totalDebit =
    moneyToCents(entry.lines.reduce((sum, journalLine) => sum + journalLine.debit, 0)) / 100;
  const totalCredit =
    moneyToCents(entry.lines.reduce((sum, journalLine) => sum + journalLine.credit, 0)) / 100;
  /**
   * The same rule the server enforces (`isJournalEntryBalanced`: exact integer
   * cents, at least two lines, each single-sided, total > 0) instead of a
   * second, weaker `Math.abs(totalDebit - totalCredit) < 0.01` float test. That
   * tolerance called a two-line 0/0 draft "Balanced" although the API refuses to
   * post it, and it also hid sub-cent float drift.
   */
  const isBalanced = isJournalEntryBalanced(
    entry.lines.map((journalLine) => ({ debit: journalLine.debit, credit: journalLine.credit })),
  );
  const balanceDifference = Math.abs(moneyToCents(totalDebit) - moneyToCents(totalCredit)) / 100;

  return (
    <Drawer
      open
      onClose={onClose}
      title={entry.ref}
      icon={Tag}
      className="max-w-2xl"
      headerExtra={
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={entry.status} config={journalStatusConfig} size="sm" />
            {entry.reversed_ref && (
              <Badge pill tone="warning" className="px-2 font-semibold border-warning/30">
                ↩ {t("accounting.journal.detail.reversalOf", { ref: entry.reversed_ref })}
              </Badge>
            )}
            {reversedByRef && (
              <Badge pill tone="warning" className="px-2 font-semibold border-warning/30">
                {t("accounting.journal.detail.reversedBy", { ref: reversedByRef })}
              </Badge>
            )}
          </div>
          {isArchived && <DetailDrawerArchivedBanner deletedAt={entry.deletedAt} />}
        </div>
      }
      headerActions={
        <div className="flex items-center gap-2">
          {isArchived && canRestore && onRestore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await onRestore();
                onClose();
              }}
              className="flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> {t("common.restore")}
            </Button>
          )}
          {!isArchived && onPrintVoucher && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrintVoucher}
              className="flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <Printer className="w-3 h-3" aria-hidden="true" />{" "}
              {t("accounting.journal.voucher.print")}
            </Button>
          )}
          {!isArchived && entry.status === "draft" && onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />{" "}
              {t("accounting.journal.detail.edit")}
            </Button>
          )}
          {!isArchived && entry.status === "posted" && onReverse && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReverse}
              className="flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold border-warning/30 text-warning hover:bg-warning/10 hover:text-warning"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />{" "}
              {t("accounting.journal.detail.reverse")}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <DetailSectionCard
          title={t("common.overview" as AppTranslationKey)}
          className="divide-y divide-border/50 p-0"
        >
          <DetailAttributeRow
            variant="inset"
            label={t("accounting.journal.detail.date")}
            value={formatDate(entry.date)}
          />
          <DetailAttributeRow
            variant="inset"
            label={t("accounting.journal.detail.createdBy")}
            value={entry.created_by || "—"}
          />
          <DetailAttributeRow
            variant="inset"
            label={t("accounting.journal.detail.fiscalYear")}
            value={entry.fiscal_year || "—"}
          />
          <DetailAttributeRow
            variant="inset"
            label={t("accounting.journal.detail.narration")}
            value={entry.description}
          />
        </DetailSectionCard>

        {(entry.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label={t("accounting.columns.journal.tags")}>
            <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5" aria-hidden="true" />
            {entry.tags!.map((tag) => (
              <Badge key={tag} pill tone="primary" className="px-2 font-bold">
                {t(`accounting.journal.tag.${tag.toLowerCase()}` as AppTranslationKey)}
              </Badge>
            ))}
          </div>
        )}

        <JournalEntryDetailLines
          entry={entry}
          accountTypeConfig={accountTypeConfig}
          getAccount={getAccount}
          totalDebit={totalDebit}
          totalCredit={totalCredit}
          formatCurrency={formatCurrency}
          t={t}
        />

        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border",
            balanceToneClass(isBalanced),
          )}
          role="status"
        >
          {isBalanced ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />{" "}
              {t("accounting.journal.detail.balanced")}
            </>
          ) : (
            <>
              {t("accounting.journal.detail.unbalanced", {
                diff: formatCurrency(balanceDifference),
              })}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
