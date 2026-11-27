import { translateApiMessage } from "@mms/fe-core/forms/translateValidationMessage";
import type React from "react";
import { useState } from "react";
import { HandCoins } from "lucide-react";
import {
  hedgeDiscontinuationRequestSchema,
  hedgeReclassificationRequestSchema,
  hedgeSettlementRequestSchema,
  todayISO,
  type Account,
  type HedgeRelationship,
} from "@mms/contracts";
import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/ui";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import { accountOptions } from "./index";
import type { HedgeAction, HedgeActionInput } from "./index";

interface HedgeActionModalProps {
  action: HedgeAction;
  hedge: HedgeRelationship;
  accounts: Account[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: HedgeActionInput) => Promise<void>;
}

/**
 * Cash settlement of the forward, reclassification of the reserve into profit or
 * loss, or discontinuation of the hedge prospectively (IFRS 9.6.5.6).
 */
export function HedgeActionModal({
  action,
  hedge,
  accounts,
  saving,
  onClose,
  onSave,
}: HedgeActionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const resetInput = (): HedgeActionInput => ({
    date: todayISO(),
    rate: "",
    accountId: "",
    reason: "",
  });
  const [input, setInput] = useState<HedgeActionInput>(resetInput);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useIdentityReset(`${action}:${hedge.id}`, () => {
    setInput(resetInput());
    setFormError(null);
    setFieldErrors({});
  });
  const { isDirty } = useDirtySnapshot(input, `true:${hedge.id}:${action}`, resetInput());
  const settle = action === "settle";
  const discontinue = action === "discontinue";
  const complete = discontinue
    ? Boolean(input.date && input.reason.trim().length >= 3)
    : Boolean(input.date && input.accountId && (!settle || input.rate.trim()));
  const submit = async () => {
    if (!complete || saving) return;
    setFormError(null);
    setFieldErrors({});
    const rate = input.rate.trim();
    const candidate = settle
      ? {
          settlementDate: input.date,
          settlementRate: rate,
          cashAccountId: input.accountId,
        }
      : discontinue
        ? { date: input.date, reason: input.reason.trim() }
        : { date: input.date, targetAccountId: input.accountId };
    const schema = settle
      ? hedgeSettlementRequestSchema
      : discontinue
        ? hedgeDiscontinuationRequestSchema
        : hedgeReclassificationRequestSchema;
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      const mapped: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        const field =
          path === "settlementDate"
            ? "date"
            : path === "settlementRate"
              ? "rate"
              : path === "cashAccountId" || path === "targetAccountId"
                ? "accountId"
                : String(path ?? "form");
        mapped[field] = translateValidationMessage(issue.message, t);
      }
      setFieldErrors(mapped);
      setFormError(t("common.formPleaseFixErrors"));
      return;
    }
    try {
      await onSave({ ...input, rate });
    } catch (error) {
      setFormError(
        mapApiFormError(error, (message) => translateApiMessage(message, t)).message ??
          t("common.formPleaseFixErrors"),
      );
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={t(
        settle
          ? "accounting.settings.hedges.settle"
          : discontinue
            ? "accounting.settings.hedges.discontinue"
            : "accounting.settings.hedges.reclassify",
      )}
      subtitle={hedge.name}
      icon={HandCoins}
      cancelLabel={t("common.cancel")}
      saveLabel={t(
        settle
          ? "accounting.settings.hedges.settle"
          : discontinue
            ? "accounting.settings.hedges.discontinue"
            : "accounting.settings.hedges.reclassify",
      )}
      onSave={submit}
      saving={saving}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      saveDisabled={!complete}
      error={formError ?? undefined}
      formId="hedge-action-form"
    >
      <form
        id="hedge-action-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <p className="m-0 text-xs text-muted-foreground text-pretty">
          {t(
            settle
              ? "accounting.settings.hedges.settleHint"
              : discontinue
                ? "accounting.settings.hedges.discontinueHint"
                : "accounting.settings.hedges.reclassifyHint",
          )}
        </p>
        <Field
          id="hedge-action-date"
          label={t("accounting.settings.hedges.actionDate")}
          required
          error={fieldErrors.date}
        >
          <DatePicker
            id="hedge-action-date"
            name="date"
            value={input.date}
            onChange={(date) => setInput((current) => ({ ...current, date }))}
          />
        </Field>
        {settle && (
          <Field
            id="hedge-action-rate"
            label={t("accounting.settings.hedges.settlementRate")}
            required
            error={fieldErrors.rate}
          >
            <Input
              id="hedge-action-rate"
              name="settlementRate"
              inputMode="decimal"
              value={input.rate}
              onChange={(event) =>
                setInput((current) => ({ ...current, rate: event.target.value }))
              }
            />
          </Field>
        )}
        {discontinue && (
          <Field
            id="hedge-action-reason"
            label={t("accounting.settings.hedges.reason")}
            required
            error={fieldErrors.reason}
          >
            <Input
              id="hedge-action-reason"
              name="reason"
              value={input.reason}
              placeholder={t("accounting.settings.hedges.reasonPlaceholder")}
              onChange={(event) =>
                setInput((current) => ({ ...current, reason: event.target.value }))
              }
            />
          </Field>
        )}
        {!discontinue && (
          <Field
            id="hedge-action-account"
            label={t(
              settle
                ? "accounting.settings.hedges.cashAccount"
                : "accounting.settings.hedges.targetAccount",
            )}
            required
            error={fieldErrors.accountId}
          >
            <FormSelect
              id="hedge-action-account"
              name="accountId"
              value={input.accountId}
              onChange={(accountId) => setInput((current) => ({ ...current, accountId }))}
              placeholder={t("accounting.journal.form.selectAccount")}
              options={
                settle
                  ? accountOptions(accounts, "Asset")
                  : accountOptions(accounts, ["Asset", "Expense", "Revenue"])
              }
            />
          </Field>
        )}
      </form>
    </FormModal>
  );
}
