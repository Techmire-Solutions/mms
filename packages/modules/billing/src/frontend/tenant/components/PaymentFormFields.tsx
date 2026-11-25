import React from "react";
import { Coins, DollarSign, FileText } from "lucide-react";
import { Input } from "@mms/ui";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { UserActorSelect } from "../host/UserActorSelect";
import { FORM_INPUT, FORM_INPUT_ERROR } from "@mms/ui";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { SectionCard } from "@mms/ui";
import { cn } from "@mms/ui";
import { coerceFinancePaymentMethod } from "@mms/contracts";
import { tryParseMoneyAmountNumber } from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { buildInitialPaymentDraft } from "../lib/paymentFormHelpers";

export interface PaymentFormFieldsProps {
  paymentDraft: ReturnType<typeof buildInitialPaymentDraft>;
  updateDraft: (patch: Partial<ReturnType<typeof buildInitialPaymentDraft>>) => void;
  errors: Record<string, string>;
  balance: number;
  activeCurrencyCode: string;
  formatCurrency: (amount: number) => string;
  paymentMethodOptions: { value: string; label: string }[];
  t: TranslationFunction;
}

export function PaymentFormFields({
  paymentDraft,
  updateDraft,
  errors,
  balance,
  activeCurrencyCode,
  formatCurrency,
  paymentMethodOptions,
  t,
}: PaymentFormFieldsProps): React.JSX.Element {
  return (
    <SectionCard
      accentColor="primary"
      icon={Coins}
      title={t("finance.paymentDetails")}
      className="shadow-sm"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field
            id="payment-amount-input"
            label={`${t("finance.columns.amount")} (${activeCurrencyCode})`}
            required
            error={errors.amount}
          >
            <div className="relative flex items-center group/input">
              <DollarSign className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="payment-amount-input"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className={cn(`${FORM_INPUT} ps-10`, errors.amount && FORM_INPUT_ERROR)}
                value={paymentDraft.amount}
                onChange={(event) => updateDraft({ amount: event.target.value })}
                required
              />
            </div>
            {(tryParseMoneyAmountNumber(paymentDraft.amount) ?? 0) < balance &&
              (tryParseMoneyAmountNumber(paymentDraft.amount) ?? 0) > 0 && (
                <p className="m-0 mt-1 text-xs text-warning">
                  {t("finance.partialPayment", {
                    balance: formatCurrency(
                      balance - (tryParseMoneyAmountNumber(paymentDraft.amount) ?? 0),
                    ),
                  })}
                </p>
              )}
          </Field>
        </div>

        <Field
          id="payment-method-select"
          label={t("finance.columns.method")}
          required
          error={errors.method}
        >
          <FormSelect
            id="payment-method-select"
            name="method"
            value={paymentDraft.method}
            onChange={(value) => updateDraft({ method: coerceFinancePaymentMethod(value) })}
            options={paymentMethodOptions}
          />
        </Field>

        <Field
          id="payment-date-input"
          label={t("finance.columns.paymentDate")}
          required
          error={errors.date}
        >
          <DatePicker
            id="payment-date-input"
            name="date"
            value={paymentDraft.date}
            onChange={(value) => updateDraft({ date: value })}
            required
          />
        </Field>

        <div className="sm:col-span-2">
          <UserActorSelect
            id="payment-receivedBy"
            label={t("finance.columns.receivedBy")}
            required
            value={paymentDraft.receivedByUserId || ""}
            onChange={(val: any) => updateDraft({ receivedByUserId: val })}
          />
        </div>

        <div className="sm:col-span-2">
          <Field id="payment-note" label={t("finance.columns.note")} error={errors.note}>
            <div className="relative flex items-center group/input">
              <FileText className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="payment-note"
                name="note"
                className={cn(`${FORM_INPUT} ps-10`, errors.note && FORM_INPUT_ERROR)}
                value={paymentDraft.note || ""}
                onChange={(event) => updateDraft({ note: event.target.value })}
                placeholder={t("finance.paymentNotePlaceholder")}
              />
            </div>
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}
