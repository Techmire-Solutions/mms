import React from "react";
import { formatMoney } from "@mms/shared";
import { BookOpen } from "lucide-react";
import { type Account, type JournalEntry, type FiscalYear } from "@/lib/data/accountingData";
import { FormModal } from "@/components/app/FormModal";
import { Button } from "@/components/ui/button";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { AccountModal } from "@/tenant/features/accounting/components/AccountModal";
import { JournalEntryLinesEditor } from "./JournalEntryLinesEditor";
import { JournalEntryFormDetailsSection } from "./JournalEntryFormDetailsSection";
import { JournalEntryCurrencyFields } from "./JournalEntryCurrencyFields";
import { JournalEntryFormTagsSection } from "./JournalEntryFormTagsSection";
import { useJournalEntryForm } from "../hooks/useJournalEntryForm";
import { useAccountQuickCreate } from "../hooks/useAccountQuickCreate";
import { useJournalLineAssist } from "../hooks/useJournalLineAssist";
import { useJournalTemplates } from "@/tenant/features/accounting/hooks/useJournalTemplates";
import type { JournalEntrySave } from "../lib/journalEntriesTypes";

interface JournalEntryFormProps {
  accounts: Account[];
  entries: JournalEntry[];
  onSave: JournalEntrySave;
  onClose: () => void;
  initial?: JournalEntry | null;
  fiscalYears: FiscalYear[];
  decimalSeparator?: "period" | "comma";
  requireNarration?: boolean;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
}

export function JournalEntryForm({
  accounts,
  entries,
  onSave,
  onClose,
  initial,
  fiscalYears,
  decimalSeparator,
  requireNarration,
  onAccountsChange,
}: JournalEntryFormProps) {
  const { formatCurrency } = useAccountingCurrency();
  const {
    t,
    fx,
    isEdit,
    activeFiscalYear,
    form,
    setForm,
    errors,
    submitting,
    totalDebit,
    totalCredit,
    isBalanced,
    completeness,
    updateLine,
    addLine,
    removeLine,
    toggleTag,
    saveEntry,
    flattenedAccountOptions,
    errorMessages,
  } = useJournalEntryForm({
    accounts,
    entries,
    onSave,
    initial,
    fiscalYears,
    decimalSeparator,
    requireNarration,
  });
  const journalTemplates = useJournalTemplates(accounts);
  const lineAssist = useJournalLineAssist({
    form,
    setForm,
    updateLine,
    toggleTag,
    templates: journalTemplates.templates,
  });

  const selectQuickCreatedAccount = React.useCallback(
    (
      target: { kind: "line"; lineIndex: number } | { kind: "field"; field: string },
      accountId: string,
    ) => {
      if (target.kind === "line") {
        updateLine(target.lineIndex, "account_id", accountId);
      }
    },
    [updateLine],
  );

  const accountQuickCreate = useAccountQuickCreate({
    accounts,
    onAccountsChange,
    onSelectAccount: selectQuickCreatedAccount,
  });

  // Stable per-render identity keeps the memoized voucher rows memoized: an
  // inline closure here re-rendered every row on every keystroke.
  const openCreateAccount = accountQuickCreate.openCreate;
  const openAddAccount = React.useCallback(
    (lineIndex: number) => openCreateAccount({ kind: "line", lineIndex }),
    [openCreateAccount],
  );

  return (
    <>
      <FormModal
        open={!accountQuickCreate.open}
        onClose={onClose}
        title={
          isEdit ? t("accounting.journal.form.editTitle") : t("accounting.journal.form.newTitle")
        }
        subtitle={activeFiscalYear || undefined}
        icon={BookOpen}
        size="xl"
        tall
        progress={completeness}
        progressLabel={t("common.formProgress")}
        cancelLabel={t("accounting.journal.form.cancel")}
        saveLabel={t("accounting.journal.form.postEntry")}
        onSave={async () => {
          await saveEntry("posted");
        }}
        saving={submitting}
        saveDisabled={!isBalanced || submitting}
        error={errorMessages}
        footerStart={
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={async () => {
              await saveEntry("draft");
            }}
          >
            {t("accounting.journal.form.saveDraft")}
          </Button>
        }
      >
        <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
          <JournalEntryFormDetailsSection
            t={t}
            form={form}
            setForm={setForm}
            errors={errors}
            fiscalYears={fiscalYears}
          />

          <JournalEntryCurrencyFields
            t={t}
            fx={fx}
            total={totalDebit}
            error={errors.exchangeRate}
          />

          <JournalEntryFormTagsSection
            t={t}
            form={form}
            toggleTag={lineAssist.toggleTemplateTag}
            templates={journalTemplates.templates}
            canSeedTemplates={journalTemplates.canSeed}
            seedingTemplates={journalTemplates.seeding}
            onSeedTemplates={journalTemplates.seedTemplates}
          />

          <JournalEntryLinesEditor
            accounts={accounts}
            accountOptions={flattenedAccountOptions}
            errors={errors}
            lines={form.lines}
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            isBalanced={isBalanced}
            formatCurrency={
              fx.isForeign
                ? (amount) => formatMoney(amount, fx.currency, { useSymbol: true })
                : formatCurrency
            }
            onAddLine={addLine}
            onRemoveLine={removeLine}
            onUpdateLine={lineAssist.updateLineAssisted}
            lockedSideFor={lineAssist.lockedSideFor}
            lockTemplateName={lineAssist.lockTemplateName}
            mirror={
              lineAssist.canMirror
                ? { checked: lineAssist.mirrorAmounts, onChange: lineAssist.setMirrorAmounts }
                : undefined
            }
            canAddAccount={accountQuickCreate.canAdd}
            onOpenAddAccount={openAddAccount}
          />
        </form>
      </FormModal>

      {accountQuickCreate.open && (
        <AccountModal
          initial={null}
          onSave={accountQuickCreate.handleSave}
          onClose={accountQuickCreate.close}
          existingCodes={accountQuickCreate.existingCodes}
        />
      )}
    </>
  );
}
