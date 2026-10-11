import { useMemo, type FormEvent } from "react";
import { CheckCircle2, DollarSign, Download, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import type { JournalEntry } from "@/lib/data/accountingData";
import {
  QUICK_ACTIONS,
  type QuickActionType,
} from "@/tenant/features/accounting/components/journalEntriesQuickActions";
import { JournalRecentEntryCard } from "@/tenant/features/accounting/components/JournalRecentEntryCard";

// Cash-flow direction comes from `resolveEntryDirection`, which reads the
// entry's own transaction type / tags through ONE source — the quick-action
// definitions — so the money-in and money-out tag sets cannot overlap. The old
// local set claimed "Capital", which the "Other expense" quick action also used,
// so a posted expense rendered as a green "+" inflow with the wrong tone.

interface JournalQuickActionsPanelProps {
  entries: JournalEntry[];
  canWrite: boolean;
  nlInput: string;
  nlSuggestion: QuickActionType | null;
  onNlSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNlChange: (inputValue: string) => void;
  onOpenPrefill: (prefillType: QuickActionType | null) => void;
  onExportCsv: () => void;
  pageScopeLabel: string;
  canPrintVoucher?: (entry: JournalEntry) => boolean;
  onPrintVoucher?: (entry: JournalEntry) => void;
}

export function JournalQuickActionsPanel({
  entries,
  canWrite,
  nlInput,
  nlSuggestion,
  onNlSubmit,
  onNlChange,
  onOpenPrefill,
  onExportCsv,
  pageScopeLabel,
  canPrintVoucher,
  onPrintVoucher,
}: JournalQuickActionsPanelProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();

  const journalStatusConfig: Record<string, StatusBadgeConfigItem> = useMemo(
    () => ({
      posted: { label: t("accounting.journal.status.posted"), cls: SEMANTIC_BADGE.successStrong },
      draft: { label: t("accounting.journal.status.draft"), cls: SEMANTIC_BADGE.warningStrong },
    }),
    [t],
  );

  const recentEntries = useMemo(
    () =>
      entries
        .toSorted((firstEntry, secondEntry) => secondEntry.date.localeCompare(firstEntry.date))
        .slice(0, 20),
    [entries],
  );

  return (
    <>
      {canWrite && (
        <article className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <header className="flex flex-wrap items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-bold text-foreground m-0">
              {t("accounting.journal.dashboard.whatHappened")}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t("accounting.journal.dashboard.typePlainLanguage")}
            </span>
          </header>
          <form onSubmit={onNlSubmit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="nl-input" className="sr-only">
                {t("accounting.journal.dashboard.nlInputAria")}
              </label>
              <Input
                id="nl-input"
                name="nlInput"
                value={nlInput}
                onChange={(event) => onNlChange(event.target.value)}
                placeholder={t("accounting.journal.dashboard.placeholderNl")}
                autoComplete="off"
                className="w-full px-4 py-3"
              />
              {nlSuggestion && (
                <div
                  className="absolute top-full start-0 mt-1 max-w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-lg z-elevated flex items-center gap-1.5"
                  role="status"
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />{" "}
                  {t("accounting.journal.dashboard.autoDetected", {
                    label: t(nlSuggestion.labelKey),
                  })}
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="min-h-11 w-full sm:w-auto px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap"
            >
              {t("accounting.journal.dashboard.record")}
            </Button>
          </form>
        </article>
      )}

      {canWrite && (
        <section aria-label={t("accounting.journal.dashboard.quickActions")}>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5 m-0">
            {t("accounting.journal.dashboard.quickActions")}
          </h3>
          <div
            role="group"
            aria-label={t("accounting.journal.dashboard.quickActions")}
            className="flex flex-wrap gap-2"
          >
            {QUICK_ACTIONS.map((quickAction) => {
              const Icon = quickAction.icon;
              return (
                <Button
                  key={quickAction.labelKey}
                  type="button"
                  variant="outline"
                  onClick={() => onOpenPrefill(quickAction.type)}
                  className="flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted hover:border-primary/30 transition-all shadow-sm"
                >
                  <Icon className="w-4 h-4 text-primary" aria-hidden="true" />{" "}
                  {t(quickAction.labelKey)}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenPrefill(null)}
              className="flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 transition-all"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />{" "}
              {t("accounting.journal.dashboard.otherTransaction")}
            </Button>
          </div>
        </section>
      )}

      <section aria-label={t("accounting.journal.dashboard.recentTransactions")}>
        <SectionHeader
          headingLevel={3}
          title={
            <span className="min-w-0 text-xs font-bold text-muted-foreground uppercase tracking-wide m-0">
              {t("accounting.journal.dashboard.recentTransactions")}
            </span>
          }
          actions={
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={onExportCsv}
              className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-11 px-2 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />{" "}
              {t("accounting.journal.exportCurrentPage")}
            </Button>
          }
        />
        <p className="mb-2 mt-0 text-xs text-muted-foreground" role="status">
          {pageScopeLabel}
        </p>

        {entries.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={DollarSign}
            title={t("accounting.journal.dashboard.noTransactionsYet")}
            description={t("accounting.journal.dashboard.useQuickActions")}
            className="rounded-2xl py-16"
          />
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <JournalRecentEntryCard
                key={entry.id}
                entry={entry}
                statusConfig={journalStatusConfig}
                formatCurrency={formatCurrency}
                onPrintVoucher={canPrintVoucher?.(entry) ? onPrintVoucher : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
