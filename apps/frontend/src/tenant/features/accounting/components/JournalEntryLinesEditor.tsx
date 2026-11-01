import { AlertCircle, BookOpen, CheckCircle2 } from "lucide-react";
import { type Account } from "@/lib/data/accountingData";
import { CheckboxField } from "@/components/ui/checkbox";
import { FieldErrorMessage } from "@/components/app/FormField";
import { FormCollectionShell } from "@/components/app/FormPrimitives";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableBody, TableHeader } from "@/components/ui/table";
import { MutedTableHeaderRow } from "@/components/reports/FinancialDebitCreditTableChrome";
import { WorkBatchTableFooter } from "@/components/common/work/WorkBatchTableFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { balanceToneClass } from "@/lib/ui/semanticTone";
import type { DraftLine } from "../lib/journalEntryFormTypes";
import { JournalEntryLineRow } from "./JournalEntryLineRow";
import { JournalEntryLinesEditorMobile } from "./JournalEntryLinesEditorMobile";
import type { JournalAmountSide } from "../hooks/useJournalLineAssist";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";

interface JournalEntryLinesEditorProps {
  accounts: readonly Account[];
  accountOptions: readonly { value: string; label: string }[];
  errors: Readonly<Record<string, string>>;
  lines: readonly DraftLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  formatCurrency: (amount: number) => string;
  onAddLine: () => void;
  onRemoveLine: (lineIndex: number) => void;
  onUpdateLine: (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => void;
  canAddAccount?: boolean;
  onOpenAddAccount?: (lineIndex: number) => void;
  viewMode?: WorkDirectoryViewMode;
  /** Side a template locked this line to; the other amount box is disabled. */
  lockedSideFor?: (lineId: string) => JournalAmountSide | undefined;
  lockTemplateName?: string | null;
  /** Shown only with exactly two lines: mirror an amount onto the other line. */
  mirror?: { checked: boolean; onChange: (checked: boolean) => void };
}

export function JournalEntryLinesEditor({
  accounts,
  accountOptions,
  errors,
  lines,
  totalDebit,
  totalCredit,
  isBalanced,
  formatCurrency,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  canAddAccount = false,
  onOpenAddAccount,
  viewMode: propViewMode,
  lockedSideFor,
  lockTemplateName,
  mirror,
}: JournalEntryLinesEditorProps) {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  return (
    <div className="space-y-4 text-start">
      <FormCollectionShell
        title={t("accounting.journal.form.linesTitle")}
        icon={BookOpen}
        addLabel={t("accounting.journal.form.addLine")}
        onAdd={onAddLine}
        listKey="journal-lines"
      >
        <div className="rounded-xl border border-border overflow-hidden">
          {viewMode === "cards" ? (
            <JournalEntryLinesEditorMobile
              accounts={accounts}
              accountOptions={accountOptions}
              errors={errors}
              lines={lines}
              totalDebit={totalDebit}
              totalCredit={totalCredit}
              formatCurrency={formatCurrency}
              canAddAccount={canAddAccount}
              onOpenAddAccount={onOpenAddAccount}
              onRemoveLine={onRemoveLine}
              onUpdateLine={onUpdateLine}
              lockedSideFor={lockedSideFor}
              lockTemplateName={lockTemplateName}
            />
          ) : (
            <Table>
              <caption className="sr-only">{t("accounting.journal.form.linesCaption")}</caption>
              <TableHeader>
                <MutedTableHeaderRow>
                  <ModuleTableHeaderCell columnKey="account" className="px-3 py-2">
                    {t("accounting.journal.detail.account")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell
                    columnKey="lineNote"
                    className="px-3 py-2 hidden md:table-cell"
                  >
                    {t("accounting.ledger.columns.lineNote")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell
                    columnKey="debit"
                    variant="currency"
                    className="px-3 py-2 w-28"
                  >
                    {t("accounting.ledger.columns.debit")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell
                    columnKey="credit"
                    variant="currency"
                    className="px-3 py-2 w-28"
                  >
                    {t("accounting.ledger.columns.credit")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell
                    columnKey="actions"
                    variant="action"
                    className="px-3 py-2 w-8"
                  >
                    <span className="sr-only">{t("common.actions")}</span>
                  </ModuleTableHeaderCell>
                </MutedTableHeaderRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {lines.map((line, lineIndex) => (
                  <JournalEntryLineRow
                    key={line.id}
                    line={line}
                    lineIndex={lineIndex}
                    account={accountMap.get(line.account_id)}
                    accountOptions={accountOptions}
                    errorMessage={errors[`line${lineIndex}`]}
                    canRemove={lines.length > 2}
                    canAddAccount={canAddAccount}
                    onOpenAddAccount={
                      onOpenAddAccount ? () => onOpenAddAccount(lineIndex) : undefined
                    }
                    onUpdateLine={onUpdateLine}
                    onRemoveLine={onRemoveLine}
                    lockedSide={lockedSideFor?.(line.id)}
                    lockTemplateName={lockTemplateName}
                  />
                ))}
              </TableBody>
              <WorkBatchTableFooter
                footerRow={{
                  className: "border-t-2 border-border bg-muted/30",
                  cells: [
                    {
                      className: "px-3 py-2 text-xs font-bold text-muted-foreground uppercase",
                      content: t("accounting.journal.form.totals"),
                    },
                    {
                      className: "hidden md:table-cell",
                      content: null,
                    },
                    {
                      className: "table-amount-cell px-3 py-2 text-info font-bold",
                      content: formatCurrency(totalDebit),
                      align: "end",
                    },
                    {
                      className: "table-amount-cell px-3 py-2 text-success font-bold",
                      content: formatCurrency(totalCredit),
                      align: "end",
                    },
                    {
                      content: null,
                    },
                  ],
                }}
              />
            </Table>
          )}
        </div>
      </FormCollectionShell>

      {mirror && (
        <CheckboxField
          id="journal-mirror-amount"
          checked={mirror.checked}
          onCheckedChange={mirror.onChange}
          label={t("accounting.journal.form.mirrorAmount")}
          className="px-1"
          labelClassName="text-xs font-semibold"
        />
      )}

      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 shadow-sm",
          balanceToneClass(isBalanced),
        )}
        role="status"
      >
        {isBalanced ? (
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
        ) : (
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
        )}
        {isBalanced
          ? t("accounting.journal.form.balanced")
          : t("accounting.journal.form.unbalanced", {
              diff: formatCurrency(Math.abs(totalDebit - totalCredit)),
            })}
      </div>
      <FieldErrorMessage message={errors.lines} />
      <FieldErrorMessage message={errors.balance} />
    </div>
  );
}
