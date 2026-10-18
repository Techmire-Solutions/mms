import React from "react";
import { BookOpen } from "lucide-react";
import { type Account, type JournalEntry, type FiscalYear } from "@/lib/data/accountingData";
import { FormModal } from "@/components/app/FormModal";
import { Button } from "@/components/ui/button";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { AccountModal } from "@/tenant/features/accounting/components/AccountModal";
import { JournalEntryLinesEditor } from "./JournalEntryLinesEditor";
import { JournalEntryFormDetailsSection } from "./JournalEntryFormDetailsSection";
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
  onAccountsChange,
}: JournalEntryFormProps) {
  const { formatCurrency } = useAccountingCurrency();
  const {
    t,
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
  } = useJournalEntryForm({ accounts, entries, onSave, initial, fiscalYears });
  const journalTemplates = useJournalTemplates(accounts);
  const lineAssist = useJournalLineAssist({
    form,
    setForm,
    updateLine,
    toggleTag,
    templates: journalTemplates.templates,
  });

  const accountQuickCreate = useAccountQuickCreate({
    accounts,
    onAccountsChange,
    onSelectAccount: (target, accountId) => {
      if (target.kind === "line") {
        updateLine(target.lineIndex, "account_id", accountId);
      }
    },
  });

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
            formatCurrency={formatCurrency}
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
            onOpenAddAccount={(lineIndex) =>
              accountQuickCreate.openCreate({ kind: "line", lineIndex })
            }
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
