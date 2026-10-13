import React from "react";
import { DEFAULT_CURRENCIES, type AppTranslationKey, type FinanceSettings } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ToggleRow } from "@/components/app/ToggleRow";
import { Field } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";

const ALL_PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "online", "card", "other"] as const;

export interface FinancePreferencesSectionProps {
  settings: FinanceSettings;
  settingsDraft: FinanceSettings;
  upd: <K extends keyof FinanceSettings>(field: K, value: FinanceSettings[K]) => void;
}

export function FinancePreferencesSection({
  settings: _settings,
  settingsDraft,
  upd,
}: FinancePreferencesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  const toggleMethod = (method: string) => {
    const paymentMethods = settingsDraft.paymentMethods || [];
    const nextMethods = paymentMethods.includes(method)
      ? paymentMethods.filter((selectedMethod) => selectedMethod !== method)
      : [...paymentMethods, method];
    upd("paymentMethods", nextMethods);
  };

  return (
    <div className="space-y-4 text-start">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="finance-currency" label={t("finance.settings.currency")}>
          <FormSelect
            id="finance-currency"
            name="currency"
            value={settingsDraft.currency}
            onChange={(value) => upd("currency", value)}
            options={DEFAULT_CURRENCIES.map((c) => ({
              value: c.code,
              label: `${c.code} — ${c.name}`,
            }))}
          />
        </Field>

        <Field id="due-days" label={t("finance.settings.dueDays")}>
          <Input
            id="due-days"
            name="dueDays"
            type="text"
            inputMode="numeric"
            min="0"
            className={FORM_INPUT}
            value={settingsDraft.dueDays || ""}
            onChange={(event) => upd("dueDays", event.target.value)}
          />
        </Field>

        <Field id="late-fee" label={t("finance.settings.lateFee")}>
          <Input
            id="late-fee"
            name="lateFeePercent"
            type="text"
            inputMode="decimal"
            placeholder="0"
            className={FORM_INPUT}
            value={settingsDraft.lateFeePercent || ""}
            onChange={(event) => upd("lateFeePercent", event.target.value)}
          />
        </Field>

        <Field id="tax-rate" label={t("finance.settings.taxRate")}>
          <Input
            id="tax-rate"
            name="taxRate"
            type="text"
            inputMode="decimal"
            placeholder="0"
            className={FORM_INPUT}
            value={settingsDraft.taxRate || ""}
            onChange={(event) => upd("taxRate", event.target.value)}
          />
        </Field>

        <Field id="reminder-days" label={t("finance.settings.reminderDays")}>
          <Input
            id="reminder-days"
            name="reminderDaysBefore"
            type="text"
            inputMode="numeric"
            min="0"
            className={FORM_INPUT}
            value={settingsDraft.reminderDaysBefore || ""}
            onChange={(event) => upd("reminderDaysBefore", event.target.value)}
          />
        </Field>
      </div>

      <div className="pt-2 border-t border-border/60">
        <Field label={t("finance.settings.paymentMethods")}>
          <div
            className="flex flex-wrap gap-2 mt-1"
            role="group"
            aria-label={t("finance.settings.paymentMethods")}
          >
            {ALL_PAYMENT_METHODS.map((method) => {
              const active = (settingsDraft.paymentMethods || []).includes(method);
              return (
                <Button
                  key={method}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMethod(method)}
                  className={cn(
                    "min-h-11 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all capitalize",
                    active
                      ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t(`finance.paymentMethod.${method}` as AppTranslationKey)}
                </Button>
              );
            })}
          </div>
        </Field>
      </div>

      <div
        className="space-y-2 pt-2 border-t border-border/60"
        role="group"
        aria-label={t("finance.settings.flags")}
      >
        <ToggleRow
          label={t("finance.settings.sendEmail")}
          description={t("finance.settings.sendEmailDescription")}
          value={settingsDraft.sendInvoiceEmail}
          onChange={(value) => upd("sendInvoiceEmail", value)}
        />
        <ToggleRow
          label={t("finance.settings.partialPayment")}
          description={t("finance.settings.partialPaymentDescription")}
          value={settingsDraft.allowPartialPayment}
          onChange={(value) => upd("allowPartialPayment", value)}
        />
        <ToggleRow
          label={t("finance.settings.discountApproval")}
          description={t("finance.settings.discountApprovalDescription")}
          value={settingsDraft.requireApproval}
          onChange={(value) => upd("requireApproval", value)}
        />
        <ToggleRow
          label={t("finance.settings.overdueReminders")}
          description={t("finance.settings.overdueRemindersDescription")}
          value={settingsDraft.overdueReminder}
          onChange={(value) => upd("overdueReminder", value)}
        />
        <ToggleRow
          label={t("finance.settings.feeReminders")}
          description={t("finance.settings.feeRemindersDescription")}
          value={settingsDraft.feeReminders}
          onChange={(value) => upd("feeReminders", value)}
        />
      </div>
    </div>
  );
}
