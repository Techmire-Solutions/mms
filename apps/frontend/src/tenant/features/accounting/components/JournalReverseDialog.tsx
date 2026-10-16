import { useId } from "react";
import { CalendarDays, FileText, Hash, Lock, Wallet } from "lucide-react";
import {
  formatDate,
  type AppTranslationKey,
  type FiscalYear,
  type JournalReversalRequest,
} from "@mms/shared";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { Field } from "@/components/app/FormField";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WarningCallout } from "@/components/app/WarningCallout";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import type { JournalEntry } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getJournalEntryLineTotals } from "@/tenant/features/accounting/lib/journalEntriesListShared";
import { useJournalReverseDialogState } from "@/tenant/features/accounting/hooks/useJournalReverseDialogState";

interface JournalReverseDialogProps {
  entry: JournalEntry;
  fiscalYears: readonly FiscalYear[];
  onOpenChange: (open: boolean) => void;
  /** Resolve `false` to keep the dialog open (server refusal). */
  onConfirm: (request: JournalReversalRequest) => Promise<boolean>;
}

const PERIOD_LABEL = {
  open: "accounting.journal.reverse.periodOpen",
  closed: "accounting.journal.reverse.periodClosed",
  unconfigured: "accounting.journal.reverse.periodUnconfigured",
} as const satisfies Record<string, AppTranslationKey>;

/**
 * Reverse Entry confirmation: shows the original transaction and its period
 * status, and collects an open-period posting date plus a mandatory reason.
 * The original entry is never deleted or edited — the server posts a new
 * linked reversing journal and records who and when.
 */
export function JournalReverseDialog({
  entry,
  fiscalYears,
  onOpenChange,
  onConfirm,
}: JournalReverseDialogProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const { user } = useAuth();
  const ids = { date: useId(), reason: useId(), remarks: useId() };
  const state = useJournalReverseDialogState(entry, fiscalYears);
  const { totalDebit } = getJournalEntryLineTotals(entry);

  return (
    <ConfirmAlertDialog
      open
      onOpenChange={onOpenChange}
      title={t("accounting.journal.actions.reverse")}
      description={t("accounting.journal.alerts.reverseConfirm", { ref: entry.ref })}
      confirmLabel={t("accounting.journal.actions.reverse")}
      cancelLabel={t("common.cancel")}
      onConfirm={() => {
        const request = state.buildRequest();
        return request ? onConfirm(request) : false;
      }}
    >
      <div className="max-h-96 space-y-4 overflow-y-auto px-1 pb-1">
        <section aria-labelledby={`${ids.date}-original`} className="space-y-2">
          <h3 id={`${ids.date}-original`} className="text-sm font-semibold text-foreground">
            {t("accounting.journal.reverse.originalSection")}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailAttributeRow
              variant="inset"
              icon={Hash}
              label={t("accounting.journal.reverse.journalNumber")}
              value={entry.ref}
            />
            <DetailAttributeRow
              variant="inset"
              icon={CalendarDays}
              label={t("accounting.journal.reverse.originalDate")}
              value={formatDate(entry.date)}
            />
            <DetailAttributeRow
              variant="inset"
              icon={Wallet}
              label={t("accounting.journal.reverse.amount")}
              value={formatCurrency(totalDebit)}
            />
            <DetailAttributeRow
              variant="inset"
              icon={Lock}
              label={t("accounting.journal.reverse.periodStatus")}
              value={t(PERIOD_LABEL[state.originalPeriod])}
            />
          </div>
          {entry.description ? (
            <DetailAttributeRow
              variant="inset"
              icon={FileText}
              label={t("accounting.journal.reverse.description")}
              value={entry.description}
            />
          ) : null}
        </section>

        <section aria-labelledby={`${ids.date}-reversal`} className="space-y-3">
          <h3 id={`${ids.date}-reversal`} className="text-sm font-semibold text-foreground">
            {t("accounting.journal.reverse.reversalSection")}
          </h3>
          {!state.originalDateAllowed && state.originalPeriod === "closed" ? (
            <WarningCallout
              density="compact"
              description={t("accounting.journal.reverse.closedPeriodNotice", {
                date: formatDate(entry.date),
              })}
            />
          ) : null}
          {!state.originalDateAllowed && !state.todayAllowed ? (
            <WarningCallout
              density="compact"
              tone="destructive"
              description={t("accounting.journal.reverse.noOpenDateNotice")}
            />
          ) : null}
          <Field
            id={ids.date}
            label={t("accounting.journal.alerts.reversalDateLabel")}
            required
            hint={t("accounting.journal.alerts.reversalDateHint", { date: formatDate(entry.date) })}
            error={
              state.dateIssue
                ? t(`accounting.journal.reverse.dateIssue.${state.dateIssue}`)
                : undefined
            }
          >
            <DatePicker
              id={ids.date}
              name="reversalDate"
              value={state.date}
              min={entry.date}
              onChange={state.setDate}
              required
            />
          </Field>
          {state.originalDateAllowed || state.todayAllowed ? (
            <div className="flex flex-wrap gap-2">
              {state.originalDateAllowed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => state.setDate(entry.date)}
                >
                  {t("accounting.journal.reverse.useOriginalDate", {
                    date: formatDate(entry.date),
                  })}
                </Button>
              ) : null}
              {state.todayAllowed && state.today !== entry.date ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => state.setDate(state.today)}
                >
                  {t("accounting.journal.reverse.useToday")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {state.priorPeriod ? (
            <WarningCallout
              density="compact"
              description={t("accounting.journal.reverse.priorPeriodWarning")}
            />
          ) : null}
          <Field
            id={ids.reason}
            label={t("accounting.journal.reverse.reasonLabel")}
            required
            error={state.reasonError ? t("accounting.journal.reverse.reasonRequired") : undefined}
          >
            <Textarea
              id={ids.reason}
              rows={2}
              maxLength={500}
              value={state.reason}
              placeholder={t("accounting.journal.reverse.reasonPlaceholder")}
              onChange={(event) => state.setReason(event.target.value)}
              required
            />
          </Field>
          <Field id={ids.remarks} label={t("accounting.journal.reverse.remarksLabel")}>
            <Textarea
              id={ids.remarks}
              rows={2}
              maxLength={1000}
              value={state.remarks}
              onChange={(event) => state.setRemarks(event.target.value)}
            />
          </Field>
          <DetailAttributeRow
            variant="inset"
            icon={Hash}
            label={t("accounting.journal.reverse.reversalRef")}
            value={`REV-${entry.ref || entry.id}`}
          />
          <p className="text-xs text-muted-foreground">
            {t("accounting.journal.reverse.recordedNote", { user: user?.name ?? "—" })}
          </p>
        </section>
      </div>
    </ConfirmAlertDialog>
  );
}
