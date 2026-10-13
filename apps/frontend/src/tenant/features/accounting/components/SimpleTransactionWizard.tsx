import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormModal } from "@/components/app/FormModal";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { type Account, type FiscalYear, type JournalEntry } from "@/lib/data/accountingData";
import { AccountModal } from "@/tenant/features/accounting/components/AccountModal";
import { SimpleTransactionWizardFooter } from "./SimpleTransactionWizardFooter";
import { SimpleTransactionWizardSteps } from "./SimpleTransactionWizardSteps";
import { StepTransactionForm } from "./SimpleTransactionStepForm";
import { StepReview } from "./SimpleTransactionStepReview";
import { StepTypeSelection } from "./SimpleTransactionStepTypeSelection";
import { type QuickActionType } from "../lib/simpleTransactionWizardTypes";
import type { JournalEntrySave } from "../lib/journalEntriesTypes";
import { useSimpleTransactionWizard } from "../hooks/useSimpleTransactionWizard";
import { useAccountQuickCreate } from "../hooks/useAccountQuickCreate";
import { resolveWizardTransactionGroups } from "../lib/simpleTransactionTemplateGroups";
import { useJournalTemplates } from "@/tenant/features/accounting/hooks/useJournalTemplates";

interface SimpleTransactionWizardProps {
  open: boolean;
  accounts: Account[];
  entries: JournalEntry[];
  fiscalYears: FiscalYear[];
  onSave: JournalEntrySave;
  onClose: () => void;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  prefillType?: QuickActionType | null;
  prefillAmount?: string;
  prefillDescription?: string;
}

export function SimpleTransactionWizard({
  open,
  accounts,
  entries,
  fiscalYears,
  onSave,
  onClose,
  onAccountsChange,
  prefillType,
  prefillAmount,
  prefillDescription,
}: SimpleTransactionWizardProps) {
  const { t } = useTranslation();
  const { formatCurrency, activeCurrency } = useAccountingCurrency();
  const { templates } = useJournalTemplates(accounts);
  const transactionGroups = useMemo(
    () => resolveWizardTransactionGroups(templates, accounts),
    [templates, accounts],
  );

  const {
    step,
    setStep,
    selectedType,
    showAdvanced,
    setShowAdvanced,
    amountTouched,
    setAmountTouched,
    submittingStatus,
    isSubmitting,
    form,
    setForm,
    stepSubtitle,
    handleTypeSelect,
    canProceed,
    handleSave,
  } = useSimpleTransactionWizard({
    open,
    accounts,
    entries,
    fiscalYears,
    onSave,
    prefillType,
    prefillAmount,
    prefillDescription,
    transactionGroups,
  });

  const accountQuickCreate = useAccountQuickCreate({
    accounts,
    onAccountsChange,
    onSelectAccount: (target, accountId) => {
      if (target.kind === "field") {
        setForm((prev) => ({ ...prev, [target.field]: accountId }));
      }
    },
  });

  return (
    <>
      <FormModal
        open={open && !accountQuickCreate.open}
        onClose={onClose}
        title={t("accounting.journal.dashboard.recordTransaction")}
        subtitle={stepSubtitle}
        size="lg"
        panelClassName="max-h-modal-xl"
        hideFooter
        headerExtra={
          <SimpleTransactionWizardSteps
            currentStep={step}
            onSelectStep={(n) => {
              if (n > step && !canProceed()) return;
              setStep(n);
            }}
          />
        }
      >
        <div
          className="space-y-4"
          onKeyDown={(event) => {
            if (step === 3 && event.key === "Enter" && !isSubmitting && canProceed()) {
              event.preventDefault();
              void handleSave("posted");
            }
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.15 }}
            >
              {step === 1 && (
                <StepTypeSelection
                  selected={selectedType}
                  onSelect={handleTypeSelect}
                  groups={transactionGroups}
                />
              )}
              {step === 2 && selectedType && (
                <StepTransactionForm
                  type={selectedType}
                  form={form}
                  setForm={setForm}
                  accounts={accounts}
                  currencySymbol={activeCurrency.symbol}
                  fiscalYears={fiscalYears}
                  entries={entries}
                  formatCurrency={formatCurrency}
                  amountTouched={amountTouched}
                  onAmountTouched={() => setAmountTouched(true)}
                  onChangeType={() => setStep(1)}
                  onProceed={() => {
                    if (canProceed()) setStep(3);
                  }}
                  canAddAccount={accountQuickCreate.canAdd}
                  onOpenAddAccount={(field) =>
                    accountQuickCreate.openCreate({ kind: "field", field })
                  }
                />
              )}
              {step === 3 && selectedType && (
                <StepReview
                  type={selectedType}
                  form={form}
                  accounts={accounts}
                  showAdvanced={showAdvanced}
                  setShowAdvanced={setShowAdvanced}
                  formatCurrency={formatCurrency}
                  onEditDetails={() => setStep(2)}
                />
              )}
            </motion.div>
          </AnimatePresence>
          <SimpleTransactionWizardFooter
            step={step}
            canProceed={canProceed()}
            hasSelectedType={Boolean(selectedType)}
            isSubmitting={isSubmitting}
            submittingStatus={submittingStatus}
            onStepChange={setStep}
            onClose={onClose}
            onSave={handleSave}
          />
        </div>
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
