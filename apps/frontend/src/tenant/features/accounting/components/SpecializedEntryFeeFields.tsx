import React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { FeeEntryInput } from "@mms/contracts";
import { FEE_ENTRY_PAYMENT_METHODS } from "@mms/contracts";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { FORM_INPUT } from "@mms/ui";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Input } from "@mms/ui";
import { Textarea } from "@mms/ui";
import { FormControl, FormField, FormItem, FormLabel } from "@mms/ui/form";
import { TranslatedFormMessage } from "@/lib/forms/TranslatedFormMessage";
import { useTranslation } from "@mms/fe-core/i18n";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";

export function SpecializedEntryFeeFields({
  form,
}: {
  form: UseFormReturn<FeeEntryInput>;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="studentId"
        render={({ field }) => (
          <FormItem>
            <div className="sm:col-span-2 space-y-2">
              <RegistryPersonSelect
                kind="student"
                id="specialized-entry-student-pick"
                name="specializedEntryStudentPick"
                label={t("accounting.journal.specializedEntry.fee.student")}
                searchLabel={t("accounting.journal.specializedEntry.fee.student")}
                searchPlaceholder={t("accounting.journal.specializedEntry.fee.studentSearch")}
                value={field.value || ""}
                onChange={(id, name) => {
                  field.onChange(id);
                  if (name) form.setValue("studentName", name);
                }}
                onPick={(id, name) => {
                  field.onChange(id);
                  // `studentName` is the invoice directory's primary column — without
                  // it the generated invoice lists with a blank name.
                  form.setValue("studentName", name);
                }}
              />
            </div>
            <TranslatedFormMessage messageKey={form.formState.errors.studentId?.message} />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="feePeriod"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-fee-period">
              {t("accounting.journal.specializedEntry.fee.period")}
            </FormLabel>
            <FormControl>
              <Input
                id="specialized-entry-fee-period"
                name="feePeriod"
                className={FORM_INPUT}
                placeholder={t("accounting.entry.periodPlaceholder")}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              />
            </FormControl>
            <TranslatedFormMessage messageKey={form.formState.errors.feePeriod?.message} />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="specialized-entry-fee-amount">
                {t("accounting.journal.specializedEntry.amount")}
              </FormLabel>
              <FormControl>
                <Input
                  id="specialized-entry-fee-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={FORM_INPUT}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              <TranslatedFormMessage messageKey={form.formState.errors.amount?.message} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="specialized-entry-fee-date">
                {t("accounting.journal.specializedEntry.date")}
              </FormLabel>
              <FormControl>
                <DatePicker
                  id="specialized-entry-fee-date"
                  name="date"
                  value={field.value}
                  onChange={field.onChange}
                  required
                />
              </FormControl>
              <TranslatedFormMessage messageKey={form.formState.errors.date?.message} />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-fee-method">
              {t("accounting.journal.specializedEntry.fee.paymentMethod")}
            </FormLabel>
            <FormControl>
              <FormSelect
                id="specialized-entry-fee-method"
                name="paymentMethod"
                value={field.value}
                onChange={field.onChange}
                options={FEE_ENTRY_PAYMENT_METHODS.map((method) => ({
                  value: method,
                  label: t(`accounting.journal.specializedEntry.fee.paymentMethods.${method}`),
                }))}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-fee-note">
              {t("accounting.journal.specializedEntry.note")}
            </FormLabel>
            <FormControl>
              <Textarea
                id="specialized-entry-fee-note"
                name="note"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
