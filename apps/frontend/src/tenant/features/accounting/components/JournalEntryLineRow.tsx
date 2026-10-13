import { Trash2 } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { ACCOUNT_TYPE_META, type Account } from "@/lib/data/accountingData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldErrorMessage } from "@/components/app/FormField";
import { FormSelectWithQuickCreate } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/useTranslation";
import type { DraftLine } from "../lib/journalEntryFormTypes";
import type { JournalAmountSide } from "../hooks/useJournalLineAssist";

interface JournalEntryLineRowProps {
  line: DraftLine;
  lineIndex: number;
  account?: Account;
  accountOptions: readonly { value: string; label: string }[];
  errorMessage?: string;
  canRemove: boolean;
  canAddAccount?: boolean;
  onOpenAddAccount?: () => void;
  onUpdateLine: (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => void;
  onRemoveLine: (lineIndex: number) => void;
  /** Side a template locked this line to; the other amount box is disabled. */
  lockedSide?: JournalAmountSide;
  lockTemplateName?: string | null;
}

export function JournalEntryLineRow({
  line,
  lineIndex,
  account,
  accountOptions,
  errorMessage,
  canRemove,
  canAddAccount = false,
  onOpenAddAccount,
  onUpdateLine,
  onRemoveLine,
  lockedSide,
  lockTemplateName,
}: JournalEntryLineRowProps) {
  const { t } = useTranslation();
  const lockHint = lockedSide
    ? t("accounting.journal.form.amountLocked", { name: lockTemplateName ?? "" })
    : undefined;

  return (
    <TableRow className="hover:bg-muted/10">
      <TableCell className="px-3 py-2">
        <FormSelectWithQuickCreate
          id={`line-${lineIndex}-account`}
          name={`lines.${lineIndex}.account_id`}
          aria-label={t("accounting.journal.form.lineAccountAria", { line: lineIndex + 1 })}
          value={line.account_id}
          onChange={(accountId) => onUpdateLine(lineIndex, "account_id", accountId)}
          placeholder={t("accounting.journal.form.selectAccount")}
          options={accountOptions}
          searchable
          canAdd={canAddAccount}
          onOpenAdd={onOpenAddAccount}
          addAriaLabel={t("accounting.coa.addAccount")}
        />
        {account && (
          <Badge
            pill
            variant="outline"
            className={`mt-0.5 px-1.5 font-bold ${ACCOUNT_TYPE_META[account.type]?.color}`}
          >
            {t(`accounting.type.${account.type}` as AppTranslationKey)} ·{" "}
            {ACCOUNT_TYPE_META[account.type]?.normalBalance === "debit"
              ? t("accounting.journal.form.drNormal")
              : t("accounting.journal.form.crNormal")}
          </Badge>
        )}
        <FieldErrorMessage message={errorMessage} className="m-0" />
      </TableCell>
      <TableCell className="px-3 py-2 hidden md:table-cell">
        <Input
          id={`line-${lineIndex}-description`}
          name={`lines.${lineIndex}.description`}
          aria-label={t("accounting.journal.form.lineDescriptionAria", { line: lineIndex + 1 })}
          value={line.description || ""}
          onChange={(event) => onUpdateLine(lineIndex, "description", event.target.value)}
          placeholder={t("accounting.journal.form.notePlaceholder")}
          className="text-xs"
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <Input
          id={`line-${lineIndex}-debit`}
          name={`lines.${lineIndex}.debit`}
          type="text"
          inputMode="decimal"
          aria-label={t("accounting.journal.form.lineDebitAria", { line: lineIndex + 1 })}
          value={line.debit}
          placeholder="0.00"
          onChange={(event) => onUpdateLine(lineIndex, "debit", event.target.value)}
          disabled={lockedSide === "credit"}
          title={lockedSide === "credit" ? lockHint : undefined}
          className="bg-info/5 text-end font-mono text-xs focus:ring-info/30"
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <Input
          id={`line-${lineIndex}-credit`}
          name={`lines.${lineIndex}.credit`}
          type="text"
          inputMode="decimal"
          aria-label={t("accounting.journal.form.lineCreditAria", { line: lineIndex + 1 })}
          value={line.credit}
          placeholder="0.00"
          onChange={(event) => onUpdateLine(lineIndex, "credit", event.target.value)}
          disabled={lockedSide === "debit"}
          title={lockedSide === "debit" ? lockHint : undefined}
          className="bg-success/5 text-end font-mono text-xs focus:ring-success/30"
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("accounting.journal.form.lineRemoveAria", { line: lineIndex + 1 })}
          onClick={() => onRemoveLine(lineIndex)}
          disabled={!canRemove}
          className="min-h-11 min-w-11 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
