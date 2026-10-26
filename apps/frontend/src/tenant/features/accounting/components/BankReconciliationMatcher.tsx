import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { notify } from "@/lib/notify";
import { useMatchBankReconciliation } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface BankReconciliationMatcherProps {
  t: TranslationFunction;
  canEdit?: boolean;
}

export function BankReconciliationMatcher({
  t,
  canEdit = true,
}: BankReconciliationMatcherProps): React.JSX.Element {
  const match = useMatchBankReconciliation();
  const [journalEntryId, setJournalEntryId] = useState("");
  const [journalLineId, setJournalLineId] = useState("");
  const [statementLineId, setStatementLineId] = useState("");

  const handleMatch = async (): Promise<void> => {
    if (!statementLineId || !journalEntryId || !journalLineId) return;
    try {
      await match.mutateAsync({ statementLineId, journalEntryId, journalLineId });
      notify.success(t("accounting.settings.bankRec.matched"));
    } catch (error) {
      notify.error(t("accounting.settings.bankRec.matchFailed"), {
        description: accountingErrorMessage(error),
      });
    }
  };

  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          id="bank-statement-line"
          name="statementLineId"
          className={FORM_INPUT}
          value={statementLineId}
          onChange={(event) => setStatementLineId(event.target.value)}
          aria-label={t("accounting.settings.bankRec.statementLine")}
        />
        <Input
          id="bank-journal-entry"
          name="journalEntryId"
          className={FORM_INPUT}
          value={journalEntryId}
          onChange={(event) => setJournalEntryId(event.target.value)}
          aria-label={t("accounting.settings.bankRec.journalEntry")}
        />
        <Input
          id="bank-journal-line"
          name="journalLineId"
          className={FORM_INPUT}
          value={journalLineId}
          onChange={(event) => setJournalLineId(event.target.value)}
          aria-label={t("accounting.settings.bankRec.journalLine")}
        />
      </div>
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11"
          onClick={async () => {
            await handleMatch();
          }}
          disabled={match.isPending}
        >
          {t("accounting.settings.bankRec.match")}
        </Button>
      )}
    </>
  );
}
