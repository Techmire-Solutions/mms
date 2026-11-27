import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, UserCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  feeEntrySchema,
  salaryEntrySchema,
  todayISO,
  type Account,
  type FeeEntryInput,
  type SalaryEntryInput,
} from "@mms/contracts";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Form } from "@mms/ui/form";
import { firstZodFieldError } from "@mms/fe-core/forms/translateZodError";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import { useProcessSpecializedEntryMutation } from "../hooks/useAccountingApi";
import { SpecializedEntryFeeFields } from "./SpecializedEntryFeeFields";
import { SpecializedEntrySalaryFields } from "./SpecializedEntrySalaryFields";

export type SpecializedEntryType = "fee" | "salary";

/**
 * The record always saves, but the ledger posting is best-effort — it is
 * skipped entirely when the workspace has no posting rules configured. Saying
 * "posted to the ledger" in that case would be untrue, so the unposted result
 * gets a warning telling the user what to fix.
 */
function notifyEntrySaved(
  ledgerPosted: boolean,
  successMessage: string,
  t: ReturnType<typeof useTranslation>["t"],
): void {
  if (ledgerPosted) {
    notify.success(successMessage);
    return;
  }
  notify.warning(t("accounting.journal.specializedEntry.notPosted"), {
    description: t("accounting.journal.specializedEntry.notPostedHint"),
  });
}

/**
 * Dynamic General Entries quick-action modal — renders Fee or Salary fields
 * based on the button that opened it, and posts the cross-module workflow via
 * `processSpecializedEntryUseCase` on the backend.
 */
export function SpecializedEntryModal({
  type,
  accounts,
  onClose,
  onAccountsChange,
}: {
  type: SpecializedEntryType;
  accounts: Account[];
  onClose: () => void;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
}): React.JSX.Element {
  return type === "fee" ? (
    <FeeEntryModal onClose={onClose} />
  ) : (
    <SalaryEntryModal accounts={accounts} onClose={onClose} onAccountsChange={onAccountsChange} />
  );
}

function FeeEntryModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const { mutateAsync } = useProcessSpecializedEntryMutation();
  // Same-frame double click must not post two ledger entries; the state flag alone
  // disables the button only after a re-render.
  const guardEntry = useSubmitGuard();
  const form = useForm<FeeEntryInput>({
    resolver: zodResolver(feeEntrySchema),
    defaultValues: {
      type: "fee",
      studentId: "",
      studentName: "",
      feePeriod: todayISO().slice(0, 7),
      amount: "",
      paymentMethod: "cash",
      date: todayISO(),
      note: "",
    },
  });

  const submitEntry = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const result = await mutateAsync(values);
      notifyEntrySaved(
        result.ledgerPosted,
        t("accounting.journal.specializedEntry.fee.success"),
        t,
      );
      onClose();
    } catch (error: unknown) {
      notify.error(t("errors.module.title"), {
        description: error instanceof Error ? error.message : t("errors.module.description"),
      });
    } finally {
      setSubmitting(false);
    }
  });

  const handleSave = (): Promise<void | undefined> => guardEntry(() => submitEntry());

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("accounting.journal.specializedEntry.fee.title")}
      subtitle={t("accounting.journal.specializedEntry.fee.subtitle")}
      icon={DollarSign}
      error={firstZodFieldError(form.formState.errors, t) || undefined}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={async () => {
        await handleSave();
      }}
      saving={submitting}
    >
      <Form {...form}>
        <form onSubmit={handleSave}>
          <SpecializedEntryFeeFields form={form} />
        </form>
      </Form>
    </FormModal>
  );
}

function SalaryEntryModal({
  accounts,
  onClose,
  onAccountsChange,
}: {
  accounts: Account[];
  onClose: () => void;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const { mutateAsync } = useProcessSpecializedEntryMutation();
  // Same-frame double click must not post two ledger entries; the state flag alone
  // disables the button only after a re-render.
  const guardEntry = useSubmitGuard();
  const form = useForm<SalaryEntryInput>({
    resolver: zodResolver(salaryEntrySchema),
    defaultValues: {
      type: "salary",
      staffId: "",
      payPeriod: todayISO().slice(0, 7),
      amount: "",
      expenseAccountId: "",
      paymentAccountId: "",
      date: todayISO(),
      note: "",
    },
  });

  const submitEntry = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const result = await mutateAsync(values);
      notifyEntrySaved(
        result.ledgerPosted,
        t("accounting.journal.specializedEntry.salary.success"),
        t,
      );
      onClose();
    } catch (error: unknown) {
      notify.error(t("errors.module.title"), {
        description: error instanceof Error ? error.message : t("errors.module.description"),
      });
    } finally {
      setSubmitting(false);
    }
  });

  const handleSave = (): Promise<void | undefined> => guardEntry(() => submitEntry());

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("accounting.journal.specializedEntry.salary.title")}
      subtitle={t("accounting.journal.specializedEntry.salary.subtitle")}
      icon={UserCheck}
      error={firstZodFieldError(form.formState.errors, t) || undefined}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={async () => {
        await handleSave();
      }}
      saving={submitting}
    >
      <Form {...form}>
        <form onSubmit={handleSave}>
          <SpecializedEntrySalaryFields
            form={form}
            accounts={accounts}
            onAccountsChange={onAccountsChange}
          />
        </form>
      </Form>
    </FormModal>
  );
}
